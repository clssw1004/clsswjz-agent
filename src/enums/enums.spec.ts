import { BusinessType } from './business-type.enum';
import { OperateType } from './operate-type.enum';
import { SyncState } from './sync-state.enum';
import { ItemType } from './item-type.enum';
import { SymbolType } from './symbol-type.enum';
import { Currency } from './currency.enum';

describe('Enums', () => {
  describe('BusinessType', () => {
    it('should have 24 business types', () => {
      const keys = Object.keys(BusinessType).filter((k) => isNaN(Number(k)));
      expect(keys.length).toBe(24);
    });

    it('should include all core types', () => {
      expect(BusinessType.ITEM).toBe('item');
      expect(BusinessType.BOOK).toBe('book');
      expect(BusinessType.CATEGORY).toBe('category');
      expect(BusinessType.FUND).toBe('fund');
      expect(BusinessType.SHOP).toBe('shop');
      expect(BusinessType.SYMBOL).toBe('symbol');
      expect(BusinessType.NOTE).toBe('note');
      expect(BusinessType.ATTACHMENT).toBe('attachment');
    });

    it('should include all extended types', () => {
      expect(BusinessType.DEBT).toBe('debt');
      expect(BusinessType.GIFT_CARD).toBe('giftCard');
      expect(BusinessType.ACTIVITY).toBe('activity');
      expect(BusinessType.ACTIVITY_DEFINITION).toBe('activityDefinition');
      expect(BusinessType.VEHICLE).toBe('vehicle');
      expect(BusinessType.FUEL_RECORD).toBe('fuelRecord');
      expect(BusinessType.ITEM_RELATION).toBe('itemRelation');
      expect(BusinessType.USER_SHARE).toBe('userShare');
      expect(BusinessType.RECURRING_CONFIG).toBe('recurringConfig');
      expect(BusinessType.BOOKKEEPING_RULE).toBe('bookkeepingRule');
      expect(BusinessType.PERIOD_CYCLE).toBe('periodCycle');
      expect(BusinessType.PERIOD_DAILY_RECORD).toBe('periodDailyRecord');
    });
  });

  describe('OperateType', () => {
    it('should have 6 operation types', () => {
      const keys = Object.keys(OperateType).filter((k) => isNaN(Number(k)));
      expect(keys.length).toBe(6);
    });

    it('should include all types (lowercase values)', () => {
      expect(OperateType.CREATE).toBe('create');
      expect(OperateType.UPDATE).toBe('update');
      expect(OperateType.DELETE).toBe('delete');
      expect(OperateType.BATCH_CREATE).toBe('batchCreate');
      expect(OperateType.BATCH_UPDATE).toBe('batchUpdate');
      expect(OperateType.BATCH_DELETE).toBe('batchDelete');
    });
  });

  describe('SyncState', () => {
    it('should have 4 states', () => {
      const keys = Object.keys(SyncState).filter((k) => isNaN(Number(k)));
      expect(keys.length).toBe(4);
    });
  });

  describe('ItemType', () => {
    it('should have INCOME and EXPENSE', () => {
      expect(ItemType.INCOME).toBe('INCOME');
      expect(ItemType.EXPENSE).toBe('EXPENSE');
    });
  });

  describe('SymbolType', () => {
    it('should have TAG and PROJECT', () => {
      expect(SymbolType.TAG).toBe('TAG');
      expect(SymbolType.PROJECT).toBe('PROJECT');
    });
  });

  describe('Currency', () => {
    it('should have 6 currencies', () => {
      const keys = Object.keys(Currency).filter((k) => isNaN(Number(k)));
      expect(keys.length).toBe(6);
    });

    it('should have CNY with ¥ symbol', () => {
      expect(Currency.CNY).toBe('¥');
    });

    it('should have USD with $ symbol', () => {
      expect(Currency.USD).toBe('$');
    });
  });
});
