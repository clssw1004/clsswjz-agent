import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ConnectionManager } from '../core/connection-manager';
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
  ) {}

  private attachmentsDir(userId: string): string {
    return path.join(this.config.get('dataPath') || './data', userId, 'attachments');
  }

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
    const dir = this.attachmentsDir(userId);
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

  async getFilePath(userId: string, id: string): Promise<{ filePath: string; attachment: AttachmentEntity }> {
    const repo = await this.connMgr.getRepository(userId, AttachmentEntity);
    const attachment = await repo.findOneBy({ id } as any);
    if (!attachment) throw new NotFoundException('附件不存在');
    const filePath = path.join(this.attachmentsDir(userId), `${attachment.id}.${attachment.extension}`);
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
      const filePath = path.join(this.attachmentsDir(userId), `${attachment.id}.${attachment.extension}`);
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
