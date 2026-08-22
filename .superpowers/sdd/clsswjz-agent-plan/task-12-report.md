# Task 12 Report: Auto-Sync Scheduler + Manual Sync Endpoint

## Status: Complete

## Changes

### 1. `server/src/meta/user.service.ts`
- Added `findAll(): Promise<MetaUser[]>` returning `this.userRepo.find()`.

### 2. `server/src/sync/sync.service.ts`
- `SyncService` now implements `OnModuleInit` and `OnModuleDestroy`.
- Injected `ConfigService` (`@nestjs/config`; ConfigModule is global in `app.module.ts`, so no module changes needed).
- New fields:
  - `syncTimer: NodeJS.Timeout | null` — handle for the periodic timer.
  - `syncingUsers: Set<string>` — in-flight guard per userId to avoid overlapping syncs.
- `onModuleInit()`: reads `sync.interval` via `config.get('sync.interval')`; only starts a `setInterval` when interval > 0 (default config value 300000 ms = 5 min). Logs startup.
- `onModuleDestroy()`: clears the interval.
- `syncAll()`:
  - Lists all users via `userService.findAll()`; if listing fails, logs and returns.
  - Skips users with empty `mainServerUrl` or `mainToken`.
  - Skips users already in `syncingUsers`.
  - For each user: `push(user.id)` then `pull(user.id)`, each user's sync wrapped in try/catch/finally so one failure doesn't block others; the in-flight entry is always removed in `finally`.
- Added helper `isSyncing(userId)` exposing the in-flight state.

### 3. `server/src/sync/sync.controller.ts`
- Added manual full-sync endpoint:
  ```typescript
  @Post('run') async run(@Req() req) {
    const userId = req.user.userId;
    await this.syncService.push(userId);
    await this.syncService.pull(userId);
    return { ok: true };
  }
  ```

## Verification
1. `cd server && npx nest build` — passed with no errors; `dist/` regenerated including updated `sync.service.js`, `user.service.js`, `sync.controller.js`.
2. Committed as `feat: auto-sync scheduler + manual sync endpoint`.

## Notes / Design decisions
- No changes needed to `meta.module.ts`: ConfigModule is registered globally in `app.module.ts`, and UserService was already exported.
- The interval guard (`interval > 0`) means setting `sync.interval=0` disables auto-sync entirely.
- Failure isolation: user listing errors abort the tick safely; per-user push/pull failures are caught and logged at warn level without stopping remaining users.
- The in-flight `Set` also protects against overlap between the scheduled tick and concurrent manual push/pull-triggered flows only where they route through `syncAll` (per-user manual endpoints are unchanged).
