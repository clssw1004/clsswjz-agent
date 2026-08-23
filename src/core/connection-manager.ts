import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
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

const USER_ENTITIES = [
  AccountBook, AccountItem, AccountCategory, AccountFund,
  AccountShop, AccountSymbol, AccountNote, AccountBookUser,
  AttachmentEntity, ItemRelField, LogSync,
];

@Injectable()
export class ConnectionManager {
  private connections = new Map<string, DataSource>();
  private dataPath: string;

  constructor(private config: ConfigService) {
    this.dataPath = config.get<string>('dataPath') || './data';
  }

  async getRepository<T extends ObjectLiteral>(
    userId: string,
    entity: new () => T,
  ): Promise<Repository<T>> {
    const ds = await this.getConnection(userId);
    return ds.getRepository(entity);
  }

  async initUserDataDir(userId: string): Promise<void> {
    const userDir = path.join(this.dataPath, userId);
    const attachDir = path.join(userDir, 'attachments');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
  }

  private async getConnection(userId: string): Promise<DataSource> {
    if (this.connections.has(userId)) {
      const ds = this.connections.get(userId)!;
      if (ds.isInitialized) return ds;
    }
    await this.initUserDataDir(userId);
    const dbPath = path.join(this.dataPath, userId, 'db.sqlite');
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
    this.connections.set(userId, ds);
    return ds;
  }

  async getDataSource(userId: string): Promise<DataSource> {
    return this.getConnection(userId);
  }

  async closeConnection(userId: string): Promise<void> {
    const ds = this.connections.get(userId);
    if (ds?.isInitialized) {
      await ds.destroy();
      this.connections.delete(userId);
    }
  }

  /**
   * 重置用户本地数据：先断开数据库连接（释放 sqlite 文件占用），再删除该用户 data 目录
   * （db.sqlite + attachments），最后重建目录骨架。下次 getConnection 会自动创建全新数据库。
   * 用于"重置凭证 & 数据重置同步"——切换账号后旧账号数据不残留。
   */
  async resetUserDataDir(userId: string): Promise<void> {
    await this.closeConnection(userId);
    const userDir = path.join(this.dataPath, userId);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
    await this.initUserDataDir(userId);
  }
}
