import { FuelService } from './fuel.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/* ---------- mock helpers ---------- */

function mockFuelRepo(seed: any[] = []) {
  const store = [...seed];
  return {
    store,
    find: jest.fn(async (q?: any) => {
      if (q?.where) {
        return store.filter((r) =>
          Object.entries(q.where).every(([k, v]) => r[k] === v),
        );
      }
      return [...store];
    }),
    findOneBy: jest.fn(async (q: any) =>
      store.find((r) => Object.entries(q).every(([k, v]) => r[k] === v)) || null,
    ),
    save: jest.fn(async (d: any) => {
      if (!d.id) d.id = 'gen-' + Math.random().toString(36).slice(2, 8);
      store.push(d);
      return d;
    }),
    create: jest.fn((d: any) => d),
    update: jest.fn(async (id: string, patch: any) => {
      const idx = store.findIndex((r) => r.id === id);
      if (idx >= 0) Object.assign(store[idx], patch);
    }),
    delete: jest.fn(async (q: any) => {
      if (typeof q === 'string') {
        const idx = store.findIndex((r) => r.id === q);
        if (idx >= 0) store.splice(idx, 1);
      }
    }),
  };
}

function mockLogRepo() {
  const store: any[] = [];
  return {
    store,
    save: jest.fn(async (d: any) => { store.push(d); return d; }),
    create: jest.fn((d: any) => d),
  };
}

function buildService(fuelSeed: any[] = []) {
  const fuelRepo = mockFuelRepo(fuelSeed);
  const logRepo = mockLogRepo();
  const connMgr = {
    getRepository: jest.fn(async (_userId: string, entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      if (name === 'LogSync') return logRepo;
      if (name === 'FuelRecord') return fuelRepo;
      throw new Error('unexpected entity: ' + name);
    }),
  } as any;
  return { service: new FuelService(connMgr), fuelRepo, logRepo };
}

/* ---------- tests ---------- */

describe('FuelService', () => {
  describe('findAll', () => {
    it('returns all records when no vehicleId filter', async () => {
      const { service, fuelRepo } = buildService([
        { id: 'f1', vehicleId: 'v1' },
        { id: 'f2', vehicleId: 'v2' },
      ]);

      const result = await service.findAll('u1', {});

      expect(result).toHaveLength(2);
      expect(fuelRepo.find).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by vehicleId when provided', async () => {
      const { service, fuelRepo } = buildService([
        { id: 'f1', vehicleId: 'v1' },
        { id: 'f2', vehicleId: 'v2' },
      ]);

      const result = await service.findAll('u1', { vehicleId: 'v1' });

      expect(result).toHaveLength(1);
      expect(fuelRepo.find).toHaveBeenCalledWith({ where: { vehicleId: 'v1' } });
    });
  });

  describe('findOne', () => {
    it('returns the record by id', async () => {
      const { service, fuelRepo } = buildService([
        { id: 'f1', vehicleId: 'v1' },
      ]);

      const result = await service.findOne('u1', 'f1');

      expect(result).toMatchObject({ id: 'f1', vehicleId: 'v1' });
      expect(fuelRepo.findOneBy).toHaveBeenCalledWith({ id: 'f1' });
    });
  });

  describe('create', () => {
    it('saves the record, sets createdBy/updatedBy, and writes an unsynced CREATE log', async () => {
      const { service, fuelRepo, logRepo } = buildService();

      const data = {
        vehicleId: 'v1',
        mileage: 12345,
        energyType: 'gasoline',
        fuelGrade: '95',
        volume: 40.5,
        unitPrice: 7.88,
        totalAmount: 319.14,
        isFullTank: 1,
        station: '中石化',
        refuelTime: 1700000000000,
      };
      const saved = await service.create('u1', data);

      expect(saved.vehicleId).toBe('v1');
      expect(saved.createdBy).toBe('u1');
      expect(saved.updatedBy).toBe('u1');
      expect(fuelRepo.save).toHaveBeenCalledTimes(1);
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log).toMatchObject({
        businessType: BusinessType.FUEL_RECORD,
        operateType: OperateType.CREATE,
        parentType: '',
        parentId: '',
        operatorId: 'u1',
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      });
      expect(log.businessId).toBe(saved.id);
      expect(typeof log.operateData).toBe('string');
      expect(JSON.parse(log.operateData).vehicleId).toBe('v1');
      expect(typeof log.operatedAt).toBe('number');
    });
  });

  describe('update', () => {
    it('applies the patch and writes an unsynced UPDATE log', async () => {
      const { service, fuelRepo, logRepo } = buildService([
        { id: 'f1', vehicleId: 'v1', mileage: 100 },
      ]);

      const updated = await service.update('u1', 'f1', { mileage: 200 });

      expect(updated.mileage).toBe(200);
      expect(fuelRepo.update).toHaveBeenCalledWith('f1', { mileage: 200, updatedBy: 'u1' });
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.FUEL_RECORD);
      expect(log.operateType).toBe(OperateType.UPDATE);
      expect(log.businessId).toBe('f1');
      expect(log.syncState).toBe(SyncState.UNSYNCED);
      expect(JSON.parse(log.operateData)).toMatchObject({ id: 'f1', mileage: 200 });
    });
  });

  describe('remove', () => {
    it('deletes the record and writes an unsynced DELETE log', async () => {
      const { service, fuelRepo, logRepo } = buildService([
        { id: 'f1', vehicleId: 'v1' },
      ]);

      const result = await service.remove('u1', 'f1');

      expect(result).toEqual({ deleted: true });
      expect(fuelRepo.delete).toHaveBeenCalledWith('f1');
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log).toMatchObject({
        businessType: BusinessType.FUEL_RECORD,
        operateType: OperateType.DELETE,
        parentType: '',
        parentId: '',
        operatorId: 'u1',
        businessId: 'f1',
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      });
    });
  });
});