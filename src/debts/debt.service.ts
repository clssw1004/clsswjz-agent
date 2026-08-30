import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { ConnectionManager } from '../core/connection-manager';
import { AccountDebt } from '../entities/account-debt.entity';
import { AccountItem } from '../entities/account-item.entity';
import { AccountFund } from '../entities/account-fund.entity';
import { LogSync } from '../entities/log-sync.entity';
import { ItemService } from '../items/item.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/** 还款/收款账目分类（对齐 gui DebtType.operationCategory） */
const PAYMENT_CATEGORIES = ['COLLECTION', 'REPAYMENT'];

/** 债务（对齐 gui debt_list_page / debt_payment_page） */
@Injectable()
export class DebtService {
  constructor(
    private connMgr: ConnectionManager,
    private itemService: ItemService,
  ) {}

  async create(userId: string, data: any) {
    const repo = await this.connMgr.getRepository(userId, AccountDebt);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);

    const debt = repo.create({
      debtType: data.debtType || 'BORROW',
      debtor: data.debtor || '',
      amount: Number(data.amount ?? 0),
      fundId: data.fundId || '',
      debtDate: data.debtDate || '',
      expectedClearDate: data.expectedClearDate || null,
      clearState: data.clearState || 'pending',
      createdBy: userId,
      updatedBy: userId,
    } as any);
    const saved = await repo.save(debt as any);

    const log = logRepo.create({
      businessType: BusinessType.DEBT,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: data.accountBookId || 'None',
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

  async listByBook(
    userId: string,
    opts: { limit?: number; offset?: number; clearState?: string; keyword?: string } = {},
  ) {
    const { limit = 50, offset = 0, clearState, keyword } = opts;
    const repo = await this.connMgr.getRepository(userId, AccountDebt);
    const qb = repo.createQueryBuilder('d').orderBy('d.createdAt', 'DESC');
    if (clearState) qb.andWhere('d.clearState = :cs', { cs: clearState });
    if (keyword) qb.andWhere('d.debtor LIKE :kw', { kw: `%${keyword}%` });

    const total = await qb.getCount();
    const rows = await qb.skip(offset).take(limit).getMany();

    // 关联账户名
    const fundRepo = await this.connMgr.getRepository(userId, AccountFund);
    const fundIds = [...new Set(rows.map((d) => d.fundId).filter(Boolean))];
    const fundMap = fundIds.length
      ? Object.fromEntries((await fundRepo.find({ where: { id: In(fundIds) } as any })).map((f) => [f.id, f.name]))
      : {};

    // 剩余金额（= 总额 - 已还款/收款汇总）
    const remainMap = await this.calcRemainingMap(userId, rows.map((d) => d.id));

    return {
      total,
      items: rows.map((d) => ({ ...d, fundName: fundMap[d.fundId] || '', ...(remainMap[d.id] || {}) })),
    };
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountDebt);
    const debt = await repo.findOneBy({ id } as any);
    if (!debt) throw new NotFoundException('债务不存在');
    const fundRepo = await this.connMgr.getRepository(userId, AccountFund);
    const remain = await this.calcRemaining(userId, id);
    // 关联账目记录（对齐 gui debt_edit_page._loadItems：sourceId 关联全部账目）
    const itemRepo = await this.connMgr.getRepository(userId, AccountItem);
    const items = await itemRepo.find({
      where: { sourceId: id } as any,
      order: { accountDate: 'DESC' } as any,
    });
    const fundIds = [...new Set([...(debt.fundId ? [debt.fundId] : []), ...items.map((i) => i.fundId).filter(Boolean)])];
    const fundMap = fundIds.length
      ? Object.fromEntries((await fundRepo.find({ where: { id: In(fundIds) } as any })).map((f) => [f.id, f.name]))
      : {};
    const fundName = fundMap[debt.fundId] || '';
    const records = items.map((i) => ({
      id: i.id,
      amount: Number(i.amount ?? 0),
      accountDate: i.accountDate,
      categoryCode: i.categoryCode,
      fundId: i.fundId,
      fundName: fundMap[i.fundId] || '',
      description: i.description || '',
    }));
    return { ...debt, fundName, ...remain, records };
  }

  async update(userId: string, id: string, data: any) {
    const repo = await this.connMgr.getRepository(userId, AccountDebt);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const debt = await repo.findOneBy({ id } as any);
    if (!debt) throw new NotFoundException('债务不存在');

    const patch: any = { updatedBy: userId };
    if (data.debtType !== undefined) patch.debtType = data.debtType;
    if (data.debtor !== undefined) patch.debtor = data.debtor;
    if (data.amount !== undefined) patch.amount = Number(data.amount);
    if (data.fundId !== undefined) patch.fundId = data.fundId;
    if (data.debtDate !== undefined) patch.debtDate = data.debtDate;
    if (data.expectedClearDate !== undefined) patch.expectedClearDate = data.expectedClearDate;
    if (data.clearState !== undefined) patch.clearState = data.clearState;
    await repo.update(id, patch);

    // 手动结清 / 重新开启时同步 clearDate
    if (data.clearState === 'cleared' && !debt.clearDate) {
      await repo.update(id, { clearDate: todayStr(), updatedBy: userId } as any);
    } else if (data.clearState && data.clearState !== 'cleared') {
      await repo.update(id, { clearDate: null, updatedBy: userId } as any);
    }

    const updated = await repo.findOneBy({ id } as any);
    const log = logRepo.create({
      businessType: BusinessType.DEBT,
      operateType: OperateType.UPDATE,
      parentType: 'book',
      parentId: updated.accountBookId || 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      operateData: JSON.stringify(updated),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return updated;
  }

  async remove(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountDebt);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const debt = await repo.findOneBy({ id } as any);
    if (debt) {
      await repo.delete(id);
      const log = logRepo.create({
        businessType: BusinessType.DEBT,
        operateType: OperateType.DELETE,
        parentType: 'book',
        parentId: debt.accountBookId || 'None',
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

  /**
   * 记一笔还款/收款（对齐 gui debt_payment_page）：
   * 生成账目记录（categoryCode = COLLECTION/REPAYMENT，sourceId = 债务 id），
   * 重算剩余金额，结清时更新 clearState = cleared。
   */
  async addPayment(userId: string, id: string, data: any) {
    const repo = await this.connMgr.getRepository(userId, AccountDebt);
    const debt = await repo.findOneBy({ id } as any);
    if (!debt) throw new NotFoundException('债务不存在');

    const categoryCode = data.categoryCode === 'COLLECTION' ? 'COLLECTION' : 'REPAYMENT';
    const amount = Math.abs(Number(data.amount ?? 0));
    // 金额方向（对齐 gui debt_payment_page：REPAYMENT 为负，COLLECTION 为正）
    const signedAmount = categoryCode === 'REPAYMENT' ? -amount : amount;

    const created = await this.itemService.create(userId, {
      amount: signedAmount,
      type: 'EXPENSE', // 方向由正负表达；还款/收款走支出账目分类
      categoryCode,
      accountDate: data.accountDate || todayStr(),
      fundId: data.fundId || debt.fundId || '',
      source: 'debt',
      sourceId: id,
      description: data.description || '',
      accountBookId: debt.accountBookId,
    } as any);

    // 重算剩余并自动结清
    const remain = await this.calcRemaining(userId, id);
    if (remain.remainAmount <= 0 && debt.clearState !== 'cleared') {
      await repo.update(id, { clearState: 'cleared', clearDate: todayStr(), updatedBy: userId } as any);
    }
    return { ...created, ...remain };
  }

  /** 单条剩余：总额 - 已还款/收款 abs 汇总 */
  async calcRemaining(userId: string, debtId: string) {
    const map = await this.calcRemainingMap(userId, [debtId]);
    return map[debtId] || { remainAmount: 0, paidAmount: 0 };
  }

  /** 批量剩余汇总 */
  async calcRemainingMap(userId: string, debtIds: string[]) {
    const result: Record<string, { remainAmount: number; paidAmount: number }> = {};
    const validIds = debtIds.filter(Boolean);
    if (!validIds.length) return result;

    const itemRepo = await this.connMgr.getRepository(userId, AccountItem);
    const payments = await itemRepo.find({
      where: { sourceId: In(validIds), categoryCode: In(PAYMENT_CATEGORIES) } as any,
    });

    const debtRepo = await this.connMgr.getRepository(userId, AccountDebt);
    const debts = await debtRepo.find({ where: { id: In(validIds) } as any });
    const amountMap = Object.fromEntries(debts.map((d) => [d.id, Number(d.amount ?? 0)]));

    const paidMap: Record<string, number> = {};
    for (const p of payments) {
      paidMap[p.sourceId] = (paidMap[p.sourceId] || 0) + Math.abs(Number(p.amount ?? 0));
    }
    for (const id of validIds) {
      const paid = paidMap[id] || 0;
      const amount = amountMap[id] || 0;
      result[id] = { remainAmount: Math.max(0, amount - paid), paidAmount: paid };
    }
    return result;
  }
}

function todayStr() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
