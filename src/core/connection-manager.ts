import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { UserService } from '../meta/user.service';
import { hostDirFromUrl } from './host.util';
import { LogSync } from '../entities/log-sync.entity';
import { AccountBook } from '../entities/account-book.entity';
import { AccountItem } from '../entities/account-item.entity';
import { AccountCategory } from '../entities/account-category.entity';
import { AccountFund } from '../entities/account-fund.entity';
import { AccountShop } from '../entities/account-shop.entity';
import { AccountSymbol } from '../entities/account-symbol.entity';
import { AccountNote } from '../entities/account-note.entity';
import { AccountBookUser } from '../entities/account-book-user.entity';
import { AttachmentEntity } from '../entities/attachment.entity';
import { ItemRelField } from '../entities/item-rel-field.entity';
import { AppUser } from '../entities/app-user.entity';
import { AccountDebt } from '../entities/account-debt.entity';
import { GiftCard } from '../entities/gift-card.entity';
import { ActivityDefinition } from '../entities/activity-definition.entity';
import { ActivityRecord } from '../entities/activity-record.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { FuelRecord } from '../entities/fuel-record.entity';
import { ItemRelation } from '../entities/item-relation.entity';
import { UserShare } from '../entities/user-share.entity';
import { RecurringConfig } from '../entities/recurring-config.entity';
import { BookkeepingRule } from '../entities/bookkeeping-rule.entity';
import { PeriodCycle } from '../entities/period-cycle.entity';
import { PeriodDailyRecord } from '../entities/period-daily-record.entity';

const USER_ENTITIES = [
  AccountBook, AccountItem, AccountCategory, AccountFund,
  AccountShop, AccountSymbol, AccountNote, AccountBookUser,
  AttachmentEntity, ItemRelField, LogSync,
  AppUser, AccountDebt, GiftCard, ActivityDefinition, ActivityRecord,
  Vehicle, FuelRecord, ItemRelation, UserShare, RecurringConfig,
  BookkeepingRule, PeriodCycle, PeriodDailyRecord,
];

@Injectable()
export class ConnectionManager {
  private readonly logger = new Logger(ConnectionManager.name);
  private connections = new Map<string, DataSource>();
  private dataPath: string;
  /**
   * userId → hostDir（数据目录隔离标识）。
   * 由 JwtStrategy.validate()（每次鉴权）/ AuthService.login() 写入，跨请求持久。
   * ⚠️ 不要用 AsyncLocalStorage 承载 host：Nest 的 guard→interceptor→handler 调用链
   * 无法可靠地把 ALS store 传到 service 层，会导致 host 恒为空串、数据落回 data/<userId>。
   */
  private userHostMap = new Map<string, string>();

  constructor(
    private config: ConfigService,
    private userService: UserService,
  ) {
    this.dataPath = config.get<string>('dataPath') || './data';
  }

  /** JWT 鉴权成功后调用：把 host 绑定到 userId（数据目录隔离的权威来源之一） */
  setHost(userId: string, host: string) {
    if (userId && host) this.userHostMap.set(userId, host);
  }

  private connKey(host: string, userId: string) { return `${host}|${userId}`; }

  /**
   * 解析用户的 hostDir，三级来源（不依赖请求上下文）：
   * 1) 内存缓存 — JwtStrategy.validate() / login() 已写入（同一进程内命中率最高）
   * 2) meta.db 的 mainServerUrl 反推 — 服务重启后首次调用、无 JWT 的定时任务兜底
   * 3) 空串 — 该用户尚未绑定任何主端（保持旧行为，数据落 data/<userId>）
   */
  async resolveHost(userId: string): Promise<string> {
    const cached = this.userHostMap.get(userId);
    if (cached) return cached;
    try {
      const user = await this.userService.findById(userId);
      const host = user?.mainServerUrl ? hostDirFromUrl(user.mainServerUrl) : '';
      if (host) this.userHostMap.set(userId, host);
      return host;
    } catch {
      return '';
    }
  }

  /** 构建用户数据目录路径 */
  getUserDataDir(host: string, userId: string): string {
    return path.join(this.dataPath, host, userId);
  }

  /** 获取用户附件目录路径（供 AttachmentService 使用） */
  getAttachmentsDir(userId: string): string {
    const host = this.userHostMap.get(userId) || '';
    return path.join(this.getUserDataDir(host, userId), 'attachments');
  }

  async getRepository<T extends ObjectLiteral>(
    userId: string,
    entity: new () => T,
  ): Promise<Repository<T>> {
    const ds = await this.getConnection(userId);
    return ds.getRepository(entity);
  }

  async initUserDataDir(host: string, userId: string): Promise<void> {
    // 只在拿到有效 host 时更新缓存，避免空串覆盖掉已绑定的正确 host
    if (host) this.userHostMap.set(userId, host);
    const userDir = this.getUserDataDir(host, userId);
    const attachDir = path.join(userDir, 'attachments');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
  }

  /**
   * 迁移历史遗留目录：早期版本 host 恒为空，数据落在 data/<userId>/；
   * 现在归位到 data/<host>/<userId>/。仅当「旧库存在且新库不存在」时执行一次，
   * 采用 rename 无损搬运，失败不阻断（回退到就地使用旧目录）。
   */
  private async migrateLegacyDir(userId: string, host: string): Promise<void> {
    if (!host) return;
    const legacyDir = path.join(this.dataPath, userId);
    const targetDir = this.getUserDataDir(host, userId);
    const legacyDb = path.join(legacyDir, 'db.sqlite');
    const targetDb = path.join(targetDir, 'db.sqlite');
    if (!fs.existsSync(legacyDb) || fs.existsSync(targetDb)) return;
    try {
      // 释放可能存在的空 host 连接（key = "|<userId>"），否则文件被占用
      const legacyKey = this.connKey('', userId);
      const stale = this.connections.get(legacyKey);
      if (stale?.isInitialized) await stale.destroy();
      this.connections.delete(legacyKey);
      fs.mkdirSync(targetDir, { recursive: true });
      for (const entry of fs.readdirSync(legacyDir)) {
        const from = path.join(legacyDir, entry);
        const to = path.join(targetDir, entry);
        if (!fs.existsSync(to)) fs.renameSync(from, to);
      }
      fs.rmSync(legacyDir, { recursive: true, force: true });
      this.logger.log(`Migrated legacy data dir: data/${userId} -> data/${host}/${userId}`);
    } catch (err) {
      this.logger.warn(`Legacy data dir migration skipped for ${userId}: ${err.message}`);
    }
  }

  private async getConnection(userId: string): Promise<DataSource> {
    const host = await this.resolveHost(userId);
    const key = this.connKey(host, userId);
    if (this.connections.has(key)) {
      const ds = this.connections.get(key)!;
      if (ds.isInitialized) return ds;
    }
    await this.migrateLegacyDir(userId, host);
    await this.initUserDataDir(host, userId);
    const dbPath = path.join(this.getUserDataDir(host, userId), 'db.sqlite');
    const ds = new DataSource({
      type: 'sqlite',
      database: dbPath,
      entities: USER_ENTITIES,
      synchronize: true,
      // WAL 允许读写并发；busy_timeout 让写锁冲突时等待而不是立刻抛 SQLITE_BUSY
      enableWAL: true,
      busyTimeout: 5000,
    });
    await ds.initialize();
    this.connections.set(key, ds);
    return ds;
  }

  async getDataSource(userId: string): Promise<DataSource> {
    return this.getConnection(userId);
  }

  async closeConnection(userId: string): Promise<void> {
    const host = await this.resolveHost(userId);
    // 一并关闭历史遗留的空 host 连接（data/<userId> 时代建立）
    for (const key of [this.connKey(host, userId), this.connKey('', userId)]) {
      const ds = this.connections.get(key);
      if (ds?.isInitialized) await ds.destroy();
      this.connections.delete(key);
    }
  }

  /**
   * 重置用户本地数据：先断开数据库连接（释放 sqlite 文件占用），再删除该用户 data 目录
   * （db.sqlite + attachments），最后重建目录骨架。下次 getConnection 会自动创建全新数据库。
   * 用于"重置凭证 & 数据重置同步"——切换账号后旧账号数据不残留。
   */
  async resetUserDataDir(userId: string): Promise<void> {
    await this.closeConnection(userId);
    const host = await this.resolveHost(userId);
    const userDir = this.getUserDataDir(host, userId);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
    // 顺带清掉历史遗留目录，否则下次仍会被迁移逻辑捡回来
    const legacyDir = path.join(this.dataPath, userId);
    if (host && fs.existsSync(legacyDir)) {
      fs.rmSync(legacyDir, { recursive: true, force: true });
    }
    await this.initUserDataDir(host, userId);
  }
}
