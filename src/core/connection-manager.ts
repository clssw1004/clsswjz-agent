import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
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

/** 从 mainServerUrl 提取目录安全的主机标识：去协议、端口、尾部斜线 */
function hostDirFromUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/:\d+$/, '').replace(/\/+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

@Injectable()
export class ConnectionManager {
  private connections = new Map<string, DataSource>();
  private dataPath: string;
  /** 请求级 host 上下文 — JwtStrategy.validate() 在每次请求时设置 */
  private hostStorage = new AsyncLocalStorage<string>();
  /** userId → hostDir 映射（登录时 + ALS 请求时累积，供非请求场景如 fullResync 使用） */
  private userHostMap = new Map<string, string>();

  constructor(private config: ConfigService) {
    this.dataPath = config.get<string>('dataPath') || './data';
  }

  /** JWT 策略每次请求调用，设置当前请求的 host */
  setHost(host: string) {
    this.hostStorage.enterWith(host);
  }

  /** 从 ALS 读取 host，失败返回空串 */
  private getHost(): string {
    return this.hostStorage.getStore() || '';
  }

  private connKey(host: string, userId: string) { return `${host}|${userId}`; }

  /** 构建用户数据目录路径 */
  getUserDataDir(host: string, userId: string): string {
    return path.join(this.dataPath, host, userId);
  }

  /** 在请求上下文中获取用户附件目录路径（供 AttachmentService 使用） */
  getAttachmentsDir(userId: string): string {
    const host = this.getHost();
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
    // 累积 host 映射，供非请求场景（auto-sync fullResync）使用
    this.userHostMap.set(userId, host);
    const userDir = this.getUserDataDir(host, userId);
    const attachDir = path.join(userDir, 'attachments');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
  }

  private async getConnection(userId: string): Promise<DataSource> {
    const host = this.getHost();
    this.userHostMap.set(userId, host);
    const key = this.connKey(host, userId);
    if (this.connections.has(key)) {
      const ds = this.connections.get(key)!;
      if (ds.isInitialized) return ds;
    }
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
    const host = this.userHostMap.get(userId) || this.getHost();
    const key = this.connKey(host, userId);
    const ds = this.connections.get(key);
    if (ds?.isInitialized) {
      await ds.destroy();
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
    const host = this.userHostMap.get(userId) || this.getHost();
    const userDir = this.getUserDataDir(host, userId);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
    await this.initUserDataDir(host, userId);
  }
}
