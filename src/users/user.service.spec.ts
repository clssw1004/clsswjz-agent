import { UserService } from './user.service';
import { SyncState } from '../enums/sync-state.enum';

/**
 * Verifies the agent-local preferences store behavior:
 * - getPreferences parses JSON and tolerates corrupt input
 * - updatePreferences merges with existing, supports null clears, never writes LogSync
 */
describe('UserService preferences', () => {
  function makeRepo(user: any) {
    const stored: any = { ...user };
    return {
      findOneBy: jest.fn(async (q: any) => (stored.id === q.id ? stored : null)),
      update: jest.fn(async (id: string, patch: any) => {
        if (stored.id !== id) return;
        Object.assign(stored, patch);
      }),
      _stored: stored,
    };
  }

  it('returns {} when preferences column is null', async () => {
    const repo = makeRepo({ id: 'u1', preferences: null as any });
    const connMgr = { getRepository: jest.fn(async () => repo) } as any;
    const svc = new UserService(connMgr);
    const out = await svc.getPreferences('u1');
    expect(out).toEqual({});
  });

  it('parses stored JSON', async () => {
    const repo = makeRepo({ id: 'u1', preferences: JSON.stringify({ defaultBookId: 'b1' }) });
    const connMgr = { getRepository: jest.fn(async () => repo) } as any;
    const svc = new UserService(connMgr);
    const out = await svc.getPreferences('u1');
    expect(out).toEqual({ defaultBookId: 'b1' });
  });

  it('falls back to {} on corrupt JSON', async () => {
    const repo = makeRepo({ id: 'u1', preferences: '{not json' });
    const connMgr = { getRepository: jest.fn(async () => repo) } as any;
    const svc = new UserService(connMgr);
    const out = await svc.getPreferences('u1');
    expect(out).toEqual({});
  });

  it('merges patch with existing and persists', async () => {
    const repo = makeRepo({ id: 'u1', preferences: JSON.stringify({ a: 1, b: 2 }) });
    const connMgr = { getRepository: jest.fn(async () => repo) } as any;
    const svc = new UserService(connMgr);
    const merged = await svc.updatePreferences('u1', { b: 99, c: 'new' });
    expect(merged).toEqual({ a: 1, b: 99, c: 'new' });
    expect(repo.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ preferences: JSON.stringify({ a: 1, b: 99, c: 'new' }) }),
    );
  });

  it('removes keys set to null', async () => {
    const repo = makeRepo({ id: 'u1', preferences: JSON.stringify({ keep: 'yes', drop: 'bye' }) });
    const connMgr = { getRepository: jest.fn(async () => repo) } as any;
    const svc = new UserService(connMgr);
    const merged = await svc.updatePreferences('u1', { drop: null });
    expect(merged).toEqual({ keep: 'yes' });
  });

  it('does not log a LogSync entry when saving preferences', async () => {
    const repo = makeRepo({ id: 'u1', preferences: null as any });
    const logRepo = {
      create: jest.fn((d: any) => d),
      save: jest.fn(async (d: any) => d),
    };
    const connMgr = {
      getRepository: jest.fn(async (uid: string, entity: any) => {
        if (entity.name === 'LogSync') return logRepo;
        return repo;
      }),
    } as any;
    const svc = new UserService(connMgr);
    await svc.updatePreferences('u1', { defaultBookId: 'b1' });
    expect(logRepo.create).not.toHaveBeenCalled();
    expect(logRepo.save).not.toHaveBeenCalled();
  });
});

// Keep SyncState import used (silence unused warning on some configs)
void SyncState;
