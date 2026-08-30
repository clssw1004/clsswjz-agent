import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { In } from 'typeorm';
import { ConnectionManager } from '../core/connection-manager';
import { UserService } from '../meta/user.service';
import { AttachmentEntity } from '../entities/attachment.entity';
import { LogSync } from '../entities/log-sync.entity';
import { AccountItem } from '../entities/account-item.entity';
import { AccountNote } from '../entities/account-note.entity';
import { AccountCategory } from '../entities/account-category.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class AttachmentService {
  constructor(
    private connMgr: ConnectionManager,
    private config: ConfigService,
    private userService: UserService,
  ) {}

  async upload(userId: string, file: Express.Multer.File, businessCode: string, businessId: string) {
    const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);

    const ext = path.extname(file.originalname).replace('.', '') || 'bin';
    const attachment = repo.create({
      originName: file.originalname,
      fileLength: file.size,
      extension: ext,
      contentType: file.mimetype,
      businessCode,
      businessId,
      createdBy: userId,
      updatedBy: userId,
    } as any);
    const saved = await repo.save(attachment as any);

    // Save file to disk as {id}.{ext}
    const dir = this.connMgr.getAttachmentsDir(userId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${saved.id}.${ext}`), file.buffer);

    // LogSync record
    const log = logRepo.create({
      businessType: BusinessType.ATTACHMENT,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: saved.id,
      operateData: JSON.stringify(saved),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);

    return saved;
  }

  async findByBusiness(userId: string, businessCode: string, businessId: string) {
    const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
    return repo.find({ where: { businessCode, businessId } as any });
  }

  /**
   * 全量分页列表（附件管理页，对齐 gui listAttachments + transferAttachments）：
   * 按创建时间倒序，可选 businessCode / 文件名关键字筛选；
   * 返回时组装 businessName 来源标题——账目 item = 分类名 + 描述、笔记 note = 标题。
   */
  async listByBook(
    userId: string,
    opts: { limit?: number; offset?: number; businessCode?: string; keyword?: string } = {},
  ) {
    const { limit = 50, offset = 0, businessCode, keyword } = opts;
    const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
    const qb = repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (businessCode) qb.andWhere('a.businessCode = :code', { code: businessCode });
    if (keyword) qb.andWhere('a.originName LIKE :kw', { kw: `%${keyword}%` });

    const total = await qb.getCount();
    const rows = await qb.skip(offset).take(limit).getMany();

    // 组装来源标题（对齐 gui vo_transfer.transferAttachments）
    const itemIds = rows.filter((a) => a.businessCode === 'item').map((a) => a.businessId);
    const noteIds = rows.filter((a) => a.businessCode === 'note').map((a) => a.businessId);
    const nameMap: Record<string, string> = {};

    if (itemIds.length) {
      const itemRepo = await this.connMgr.getRepository(userId, AccountItem);
      const categoryRepo = await this.connMgr.getRepository(userId, AccountCategory);
      const items = await itemRepo.find({ where: { id: In(itemIds) } as any });
      const catCodes = [...new Set(items.map((i) => i.categoryCode).filter(Boolean))];
      const catMap = catCodes.length
        ? Object.fromEntries(
            (await categoryRepo.find({ where: { code: In(catCodes) } as any })).map((c) => [c.code, c.name]),
          )
        : {};
      for (const it of items) {
        nameMap[it.id] = `${catMap[it.categoryCode] ?? ''}${it.description ?? ''}`;
      }
    }
    if (noteIds.length) {
      const noteRepo = await this.connMgr.getRepository(userId, AccountNote);
      const notes = await noteRepo.find({ where: { id: In(noteIds) } as any });
      for (const n of notes) nameMap[n.id] = n.title ?? '';
    }

    return {
      total,
      items: rows.map((a) => ({ ...a, businessName: nameMap[a.businessId] ?? '' })),
    };
  }

  /**
   * 懒加载取文件（对齐 gui downloadAttachment）：
   * 本地已有 → 直接返回；缺失（同步只拉元数据）→ 从主端按需下载并缓存到附件目录。
   */
  async getOrDownloadFile(userId: string, id: string): Promise<{ filePath: string; attachment: AttachmentEntity }> {
    const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
    const attachment = await repo.findOneBy({ id } as any);
    if (!attachment) throw new NotFoundException('附件不存在');

    const dir = this.connMgr.getAttachmentsDir(userId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = attachment.extension?.startsWith('.') ? attachment.extension : `.${attachment.extension || 'bin'}`;
    const filePath = path.join(dir, `${attachment.id}${ext}`);

    if (!fs.existsSync(filePath)) {
      await this.downloadFromMain(userId, attachment, filePath);
    }
    return { filePath, attachment };
  }

  /** 从主端下载附件文件并缓存（GET {main}/api/attachments/{id}，Bearer 主端 token） */
  private async downloadFromMain(userId: string, attachment: AttachmentEntity, destPath: string): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user?.mainServerUrl || !user.mainToken) throw new NotFoundException('未配置主端，无法下载附件');
    try {
      const resp = await axios.get(`${user.mainServerUrl}/api/attachments/${attachment.id}`, {
        headers: { Authorization: `Bearer ${user.mainToken}` },
        responseType: 'arraybuffer',
        timeout: 30_000,
      });
      fs.writeFileSync(destPath, Buffer.from(resp.data));
      // 修正扩展名与 content_type 缺失的历史元数据
      const contentType = String(resp.headers['content-type'] || '');
      const patch: any = {};
      if (contentType && !attachment.contentType) patch.contentType = contentType;
      if (Object.keys(patch).length) {
        const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
        await repo.update(attachment.id, patch);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) throw new NotFoundException('主端不存在该附件文件');
      throw new NotFoundException(`附件下载失败: ${err?.message || err}`);
    }
  }

  /** 兼容旧调用：仅读本地，不触发下载 */
  async getFilePath(userId: string, id: string): Promise<{ filePath: string; attachment: AttachmentEntity }> {
    const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
    const attachment = await repo.findOneBy({ id } as any);
    if (!attachment) throw new NotFoundException('附件不存在');
    const dir = this.connMgr.getAttachmentsDir(userId);
    const ext = attachment.extension?.startsWith('.') ? attachment.extension : `.${attachment.extension || 'bin'}`;
    const filePath = path.join(dir, `${attachment.id}${ext}`);
    if (!fs.existsSync(filePath)) throw new NotFoundException('文件不存在');
    return { filePath, attachment };
  }

  async remove(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);

    const attachment = await repo.findOneBy({ id } as any);
    if (attachment) {
      await repo.delete(id);
      // Delete file from disk
      const dir = this.connMgr.getAttachmentsDir(userId);
      const ext = attachment.extension?.startsWith('.') ? attachment.extension : `.${attachment.extension || 'bin'}`;
      const filePath = path.join(dir, `${attachment.id}${ext}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      const log = logRepo.create({
        businessType: BusinessType.ATTACHMENT,
        operateType: OperateType.DELETE,
        parentType: 'book',
        parentId: 'None',
        operatorId: userId,
        operatedAt: Date.now(),
        businessId: id,
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      } as any);
      await logRepo.save(log as any);
    }
    return { deleted: true };
  }
}

