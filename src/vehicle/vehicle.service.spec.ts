import { VehicleService } from './vehicle.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/* ---------- mock helpers ---------- */

function mockVehicleRepo(seed: any[] = []) {
  const store = [...seed];
  return {
    store,
    find: jest.fn(async () => [...store]),
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

function buildService(vehicleSeed: any[] = []) {
  const vehicleRepo = mockVehicleRepo(vehicleSeed);
  const logRepo = mockLogRepo();
  const connMgr = {
    getRepository: jest.fn(async (_userId: string, entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      if (name === 'LogSync') return logRepo;
      if (name === 'Vehicle') return vehicleRepo;
      throw new Error('unexpected entity: ' + name);
    }),
  } as any;
  return { service: new VehicleService(connMgr), vehicleRepo, logRepo };
}

/* ---------- tests ---------- */

describe('VehicleService', () => {
  describe('findAll', () => {
    it('returns all vehicles with no where filter', async () => {
      const { service, vehicleRepo } = buildService([
        { id: 'v1', plateNumber: '京A12345' },
        { id: 'v2', plateNumber: '京B67890' },
      ]);

      const result = await service.findAll('u1');

      expect(result).toHaveLength(2);
      expect(vehicleRepo.find).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('returns the vehicle by id', async () => {
      const { service, vehicleRepo } = buildService([
        { id: 'v1', plateNumber: '京A12345' },
      ]);

      const result = await service.findOne('u1', 'v1');

      expect(result).toMatchObject({ id: 'v1', plateNumber: '京A12345' });
      expect(vehicleRepo.findOneBy).toHaveBeenCalledWith({ id: 'v1' });
    });
  });

  describe('create', () => {
    it('saves the vehicle, sets createdBy/updatedBy, and writes an unsynced CREATE log', async () => {
      const { service, vehicleRepo, logRepo } = buildService();

      const data = {
        plateNumber: '京A12345',
        brand: '丰田',
        model: '凯美瑞',
        remark: '家用',
        defaultFuelGrade: '95',
        isActive: 1,
        sortOrder: 0,
      };
      const saved = await service.create('u1', data);

      expect(saved.plateNumber).toBe('京A12345');
      expect(saved.createdBy).toBe('u1');
      expect(saved.updatedBy).toBe('u1');
      expect(vehicleRepo.save).toHaveBeenCalledTimes(1);
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log).toMatchObject({
        businessType: BusinessType.VEHICLE,
        operateType: OperateType.CREATE,
        parentType: '',
        parentId: '',
        operatorId: 'u1',
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      });
      expect(log.businessId).toBe(saved.id);
      expect(typeof log.operateData).toBe('string');
      expect(JSON.parse(log.operateData).plateNumber).toBe('京A12345');
      expect(typeof log.operatedAt).toBe('number');
    });
  });

  describe('update', () => {
    it('applies the patch and writes an unsynced UPDATE log', async () => {
      const { service, vehicleRepo, logRepo } = buildService([
        { id: 'v1', plateNumber: '京A12345', brand: '丰田' },
      ]);

      const updated = await service.update('u1', 'v1', { brand: '本田' });

      expect(updated.brand).toBe('本田');
      expect(vehicleRepo.update).toHaveBeenCalledWith('v1', { brand: '本田', updatedBy: 'u1' });
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.VEHICLE);
      expect(log.operateType).toBe(OperateType.UPDATE);
      expect(log.businessId).toBe('v1');
      expect(log.syncState).toBe(SyncState.UNSYNCED);
      expect(JSON.parse(log.operateData)).toMatchObject({ id: 'v1', brand: '本田' });
    });
  });

  describe('remove', () => {
    it('deletes the vehicle and writes an unsynced DELETE log', async () => {
      const { service, vehicleRepo, logRepo } = buildService([
        { id: 'v1', plateNumber: '京A12345' },
      ]);

      const result = await service.remove('u1', 'v1');

      expect(result).toEqual({ deleted: true });
      expect(vehicleRepo.delete).toHaveBeenCalledWith('v1');
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log).toMatchObject({
        businessType: BusinessType.VEHICLE,
        operateType: OperateType.DELETE,
        parentType: '',
        parentId: '',
        operatorId: 'u1',
        businessId: 'v1',
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      });
    });
  });
});