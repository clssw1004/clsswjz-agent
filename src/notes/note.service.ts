import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountNote } from '../entities/account-note.entity';
import { AccountSymbol } from '../entities/account-symbol.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SymbolType } from '../enums/symbol-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class NoteService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: { accountBookId?: string; noteType?: string; groupCode?: string }) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const where: any = {};
    if (query.accountBookId) where.accountBookId = query.accountBookId;
    if (query.noteType) where.noteType = query.noteType;
    if (query.groupCode) where.groupCode = query.groupCode;
    return repo.find({ where });
  }

  /** 记事分组列表（noteGroup symbol，对齐 gui listSymbolsByBook symbolType=noteGroup） */
  async findGroups(userId: string) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    return repo.find({ where: { symbolType: SymbolType.NOTE_GROUP } });
  }

  /** 创建 noteGroup（对齐 gui SymbolCULog.create(symbolType=noteGroup)）
   *  写入 symbolType=NOTE_GROUP 的 AccountSymbol 同时记录 SYMBOL 日志。
   *  accountBookId 留空串以表示「全局分组」（note 已全局化，不绑定账本） */
  async createGroup(userId: string, data: { name: string; accountBookId?: string }) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const symbol = repo.create({
      name: data.name,
      code: this.genNanoId8(),
      accountBookId: data.accountBookId ?? '',
      symbolType: SymbolType.NOTE_GROUP,
      createdBy: userId,
      updatedBy: userId,
    } as any);
    const saved = await repo.save(symbol as any);
    const log = logRepo.create({
      businessType: BusinessType.SYMBOL,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: saved.accountBookId || '',
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

  /** 重命名 noteGroup（对齐 gui SymbolCULog.update(name:)）—— 写 SYMBOL 日志 */
  async updateGroup(userId: string, id: string, data: { name: string }) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { name: data.name, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.SYMBOL,
      operateType: OperateType.UPDATE,
      parentType: 'book',
      parentId: updated?.accountBookId ?? '',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      operateData: JSON.stringify({ id, name: data.name }),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return updated;
  }

  /** 删除 noteGroup（对齐 gui SYMBOL/DELETE；note 的 groupCode 字符串无 FK 约束，保留悬空值不影响数据完整性） */
  async removeGroup(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const symbol = await repo.findOneBy({ id });
    if (!symbol) return { deleted: false };
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.SYMBOL,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: symbol.accountBookId ?? '',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return { deleted: true };
  }

  /** 8 位 nano id（对齐 gui IdUtil.genNanoId8）—— JS 版：用 crypto.randomBytes 太重；
   *  直接用时间戳 ms 6 位 + 随机 2 位，碰撞概率足够低（每用户 1k 个以下分组） */
  private genNanoId8(): string {
    const ts = Date.now().toString(36).slice(-6);
    const rand = Math.random().toString(36).slice(2, 4).padEnd(2, '0');
    return (ts + rand).toLowerCase();
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<AccountNote>) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const note = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(note as any);
    const log = logRepo.create({
      businessType: BusinessType.NOTE,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: data.accountBookId,
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

  async update(userId: string, id: string, data: Partial<AccountNote>) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.NOTE,
      operateType: OperateType.UPDATE,
      parentType: 'book',
      parentId: updated?.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      operateData: JSON.stringify({ id, ...data }),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return updated;
  }

  async remove(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const note = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.NOTE,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: note?.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return { deleted: true };
  }
}
