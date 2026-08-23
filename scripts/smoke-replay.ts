/**
 * 回放对齐冒烟测试（临时脚本，验证后删除）
 * 覆盖：13 个新增业务类型 + 全部操作类型（create/update/delete/batchUpdate/batchDelete）+ 幂等重放
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { LogSync } from '../src/entities/log-sync.entity';
import { SyncState } from '../src/enums/sync-state.enum';
import { BusinessType } from '../src/enums/business-type.enum';
import { OperateType } from '../src/enums/operate-type.enum';
import { LogRunner } from '../src/sync/log-runner';
import { AccountBook } from '../src/entities/account-book.entity';
import { AccountItem } from '../src/entities/account-item.entity';
import { AccountCategory } from '../src/entities/account-category.entity';
import { AccountFund } from '../src/entities/account-fund.entity';
import { AccountShop } from '../src/entities/account-shop.entity';
import { AccountSymbol } from '../src/entities/account-symbol.entity';
import { AccountNote } from '../src/entities/account-note.entity';
import { AccountBookUser } from '../src/entities/account-book-user.entity';
import { AttachmentEntity } from '../src/entities/attachment.entity';
import { ItemRelField } from '../src/entities/item-rel-field.entity';
import { AppUser } from '../src/entities/app-user.entity';
import { AccountDebt } from '../src/entities/account-debt.entity';
import { GiftCard } from '../src/entities/gift-card.entity';
import { ActivityDefinition } from '../src/entities/activity-definition.entity';
import { ActivityRecord } from '../src/entities/activity-record.entity';
import { Vehicle } from '../src/entities/vehicle.entity';
import { FuelRecord } from '../src/entities/fuel-record.entity';
import { ItemRelation } from '../src/entities/item-relation.entity';
import { UserShare } from '../src/entities/user-share.entity';
import { RecurringConfig } from '../src/entities/recurring-config.entity';
import { BookkeepingRule } from '../src/entities/bookkeeping-rule.entity';
import { PeriodCycle } from '../src/entities/period-cycle.entity';
import { PeriodDailyRecord } from '../src/entities/period-daily-record.entity';

const ENTITIES = [
  AccountBook, AccountItem, AccountCategory, AccountFund,
  AccountShop, AccountSymbol, AccountNote, AccountBookUser,
  AttachmentEntity, ItemRelField, LogSync,
  AppUser, AccountDebt, GiftCard, ActivityDefinition, ActivityRecord,
  Vehicle, FuelRecord, ItemRelation, UserShare, RecurringConfig,
  BookkeepingRule, PeriodCycle, PeriodDailyRecord,
];

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

function mkLog(
  businessType: string, operateType: string, businessId: string,
  operateData: string, parentId = 'book1', operatorId = 'u1', id?: string,
): LogSync {
  return {
    id: id || `${businessType}-${operateType}-${businessId}-${Math.random().toString(36).slice(2, 8)}`,
    parentType: 'book',
    parentId,
    operatorId,
    operatedAt: Date.now(),
    businessType: businessType as any,
    operateType: operateType as any,
    businessId,
    operateData,
    syncState: SyncState.SYNCED,
    syncTime: Date.now(),
  } as LogSync;
}

async function main() {
  const ds = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: ENTITIES,
    synchronize: true,
  });
  await ds.initialize();
  const runner = new LogRunner();

  console.log('\n[1] 新增 12 类业务类型 create/update/delete 回放');
  const cases: Array<[BusinessType, any, string]> = [
    [BusinessType.DEBT, { accountBookId: 'b1', debtType: 'borrow', debtor: '张三', amount: 100, fundId: 'f1', debtDate: '2026-01-01' }, 'account_debts'],
    [BusinessType.GIFT_CARD, { fromUserId: 'u1', toUserId: 'u2', description: '生日卡', status: 'pending' }, 'gift_cards'],
    [BusinessType.ACTIVITY, { accountBookId: 'b1', activityName: '晨跑', recordDate: '2026-01-01' }, 'activity_records'],
    [BusinessType.ACTIVITY_DEFINITION, { accountBookId: 'b1', name: '晨跑', emoji: '🏃', color: 0 }, 'activity_definitions'],
    [BusinessType.VEHICLE, { plateNumber: '京A12345', brand: 'BYD', model: '汉' }, 'vehicles'],
    [BusinessType.FUEL_RECORD, { vehicleId: 'v1', mileage: 100, energyType: 'gas', fuelGrade: '92', volume: 10, unitPrice: 7, totalAmount: 70, refuelTime: 1700000000000 }, 'fuel_records'],
    [BusinessType.ITEM_RELATION, { itemId: 'i1', accountBookId: 'b1', relationCode: 'LINK', relationId: 'r1' }, 'item_relations'],
    [BusinessType.USER_SHARE, { ownerUserId: 'u1', targetUserId: 'u2', businessType: 'item', isEnabled: true }, 'user_shares'],
    [BusinessType.RECURRING_CONFIG, { accountBookId: 'b1', type: 'expense', amount: 50, categoryCode: 'food', fundId: 'f1', frequencyType: 'monthly', frequencyValue: '1', startDate: '2026-01-01', endType: 'forever' }, 'recurring_configs'],
    [BusinessType.BOOKKEEPING_RULE, { accountBookId: 'b1', name: '餐饮规则', isActive: true, priority: 1, conditionsJson: '{}', actionsJson: '{}' }, 'bookkeeping_rules'],
    [BusinessType.PERIOD_CYCLE, { startDate: '2026-01-01' }, 'period_cycles'],
    [BusinessType.PERIOD_DAILY_RECORD, { cycleId: 'c1', recordDate: '2026-01-01', flowLevel: 'light', symptoms: ['a', 'b'] }, 'period_daily_records'],
  ];

  for (const [bt, payload, table] of cases) {
    const id = `${bt}-1`;
    const repo = ds.getRepository(table);
    // create
    await runner.runLogSync(mkLog(bt as string, OperateType.CREATE, id, JSON.stringify(payload)), ds);
    let row = await repo.findOneBy({ id });
    assert(!!row, `${bt as string} create 落库`);
    // create 幂等重放：同 id 再执行不报错、行数不变
    const countBefore = await repo.count();
    await runner.runLogSync(mkLog(bt as string, OperateType.CREATE, id, JSON.stringify(payload)), ds);
    const countAfter = await repo.count();
    assert(countBefore === countAfter, `${bt as string} create 幂等（行数不变）`);
    // update
    await runner.runLogSync(mkLog(bt as string, OperateType.UPDATE, id, JSON.stringify({ id, ...payload, remark: 'x' })), ds);
    row = await repo.findOneBy({ id });
    assert(!!row, `${bt as string} update 不丢行`);
    // update 幂等：目标行存在，重复更新不报错
    await runner.runLogSync(mkLog(bt as string, OperateType.UPDATE, id, JSON.stringify({ id, ...payload, remark: 'x' })), ds);
    assert(true, `${bt as string} update 幂等`);
    // delete
    await runner.runLogSync(mkLog(bt as string, OperateType.DELETE, id, ''), ds);
    row = await repo.findOneBy({ id });
    assert(!row, `${bt as string} delete 已删除`);
    // delete 幂等：重复删除不报错
    await runner.runLogSync(mkLog(bt as string, OperateType.DELETE, id, ''), ds);
    assert(true, `${bt as string} delete 幂等`);
  }

  console.log('\n[2] USER 业务实体回放（materialize 已放开）');
  const userRepo = ds.getRepository(AppUser);
  const uid = 'user-1';
  await runner.runLogSync(mkLog(BusinessType.USER, OperateType.CREATE, uid, JSON.stringify({ id: uid, username: 'alice', nickname: '爱丽丝', password: 'x', language: 'zh-CN', timezone: 'Asia/Shanghai' }), 'NONE'), ds);
  assert(!!(await userRepo.findOneBy({ id: uid })), 'user create 落库');

  console.log('\n[3] category/shop 批量操作回放（batchUpdate/batchDelete）');
  for (const bt of [BusinessType.CATEGORY, BusinessType.SHOP]) {
    const table = bt === BusinessType.CATEGORY ? 'account_categories' : 'account_shops';
    const repo = ds.getRepository(table);
    const ids = [`${bt}-a`, `${bt}-b`, `${bt}-c`];
    for (const id of ids) {
      const payload = bt === BusinessType.CATEGORY
        ? { id, accountBookId: 'b1', name: id, code: `code-${id}`, categoryType: 'expense', sortOrder: 1 }
        : { id, accountBookId: 'b1', name: id, code: `code-${id}`, sortOrder: 1 };
      await runner.runLogSync(mkLog(bt as string, OperateType.CREATE, id, JSON.stringify(payload)), ds);
    }
    // batchUpdate {ids, data:[JSON串]}
    const buData = JSON.stringify({ ids, data: [JSON.stringify({ sortOrder: 9 }), JSON.stringify({ sortOrder: 8 }), JSON.stringify({ sortOrder: 7 })] });
    await runner.runLogSync(mkLog(bt as string, OperateType.BATCH_UPDATE, ids[0], buData), ds);
    const first = await repo.findOneBy({ id: ids[0] });
    assert(first?.sortOrder === 9, `${bt as string} batchUpdate 生效`);
    // batchDelete {ids}
    await runner.runLogSync(mkLog(bt as string, OperateType.BATCH_DELETE, ids[0], JSON.stringify({ ids })), ds);
    const remain = await repo.count();
    assert(remain === 0, `${bt as string} batchDelete 全部删除`);
  }

  console.log('\n[4] book 级联删除（对齐 BookDLog）');
  const bookId = 'book-1';
  await runner.runLogSync(mkLog(BusinessType.BOOK, OperateType.CREATE, bookId, JSON.stringify({ id: bookId, name: '家庭账本', currencySymbol: '¥' }), 'NONE'), ds);
  await runner.runLogSync(mkLog(BusinessType.CATEGORY, OperateType.CREATE, 'cat-1', JSON.stringify({ id: 'cat-1', accountBookId: bookId, name: '餐饮', code: 'cat-1', categoryType: 'expense' }), bookId), ds);
  await runner.runLogSync(mkLog(BusinessType.ITEM, OperateType.CREATE, 'item-1', JSON.stringify({ id: 'item-1', accountBookId: bookId, amount: 10, type: 'expense', accountDate: '2026-01-01' }), bookId), ds);
  await runner.runLogSync(mkLog(BusinessType.BOOK, OperateType.DELETE, bookId, ''), ds);
  assert(!(await ds.getRepository(AccountBook).findOneBy({ id: bookId })), 'book 删除');
  assert(!(await ds.getRepository(AccountCategory).findOneBy({ id: 'cat-1' })), 'book 级联删 category');
  assert(!(await ds.getRepository(AccountItem).findOneBy({ id: 'item-1' })), 'book 级联删 item');

  console.log('\n[5] item 多标签回放保留');
  const itemId = 'item-tag-1';
  await runner.runLogSync(mkLog(BusinessType.ITEM, OperateType.CREATE, itemId, JSON.stringify({ id: itemId, accountBookId: 'b1', amount: 1, type: 'expense', accountDate: '2026-01-01', tagCodes: ['t1', 't2'] })), ds);
  const tags = await ds.getRepository(ItemRelField).find({ where: { itemId } as any });
  assert(tags.length === 2, `item 多标签 ${tags.length} 个关联`);

  console.log(`\n===== 结果: ${passed} 通过, ${failed} 失败 =====`);
  await ds.destroy();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('冒烟测试异常:', e); process.exit(1); });
