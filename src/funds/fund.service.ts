import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountFund } from '../entities/account-fund.entity';

@Injectable()
export class FundService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: { accountBookId?: string }) {
    const repo = await this.connMgr.getRepository(userId, AccountFund);
    const where: any = {};
    if (query.accountBookId) where.accountBookId = query.accountBookId;
    return repo.find({ where });
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountFund);
    return repo.findOneBy({ id });
  }
}
