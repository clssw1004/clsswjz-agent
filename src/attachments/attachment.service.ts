import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectionManager } from '../core/connection-manager';
import { UserService } from '../meta/user.service';
import { AttachmentEntity } from '../entities/attachment.entity';
import { LogSync } from '../entities/log-sync.entity';
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

