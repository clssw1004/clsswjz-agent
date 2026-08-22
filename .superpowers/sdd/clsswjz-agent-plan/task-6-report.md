# Task 6 Report: Sync Module

## Status: Complete

## What Was Done

### Step 1: `getDataSource` on ConnectionManager
Added a public method to `server/src/core/connection-manager.ts` that exposes the per-user SQLite `DataSource` (previously private via `getConnection`). It simply delegates to the existing private `getConnection(userId)`, which handles lazy initialization of the user's data directory and SQLite connection.

```typescript
async getDataSource(userId: string): Promise<DataSource> {
  return this.getConnection(userId);
}
```

### Steps 2-6: New sync module (`server/src/sync/`)
Created 5 files, exactly as specified:

- **log-runner.ts** — `LogRunner.runLogSync(log, ds)`. Maps `BusinessType` to the corresponding TypeORM entity class (BOOK/ITEM/CATEGORY/FUND/SHOP/SYMBOL/NOTE/BOOK_MEMBER/ATTACHMENT) and applies the log's `operateData` according to `OperateType` (CREATE/BATCH_CREATE -> `save`, UPDATE -> `update(businessId, fields)`, DELETE -> `delete(businessId)`, BATCH_DELETE -> `delete(data.ids)` falling back to `businessId`). Unknown business types are silently skipped.
- **materialize.service.ts** — `MaterializeService.flush(userId)` with per-user in-flight promise dedup (`flushPromises` map) so concurrent flush calls coalesce. Loops over batches of 100 `LogSync` rows where `syncState = SYNCED` and `materializedAt = 0`, ordered by `operatedAt ASC`. Skips materialization for USER/ROOT/FUND_BOOK business types (just marks them materialized), otherwise runs LogRunner then stamps `materializedAt`. Per-log failures are recorded in `materializeError` and logged as warnings without aborting the batch.
- **sync.service.ts** — `SyncService` with three operations:
  - `push(userId)`: loads user from `UserService.findById`, finds all `UNSYNCED` logs ordered by `operatedAt`, POSTs them to `${user.mainServerUrl}/api/sync/push` with Bearer auth from `user.mainToken`, then updates each log's `syncState`/`syncError`/`syncTime` from the response `results[]`.
  - `pull(userId, commitId?)`: determines `syncTimeStamp` from the most recent SYNCED log, pages through `${user.mainServerUrl}/api/sync/pull` at pageSize 1000, inserts only logs whose ids don't already exist locally (as SYNCED), then triggers `materialize.flush(userId)` if anything was pulled.
  - `getStatus(userId)`: returns counts of UNSYNCED and FAILED logs.
- **sync.controller.ts** — Routes: `POST /sync/push`, `POST /sync/pull` (accepts optional `{ commitId }` body), `GET /sync/status`. All read `req.user.userId` (set by the global JwtAuthGuard).
- **sync.module.ts** — Declares controller; provides SyncService, MaterializeService, LogRunner; exports SyncService.

### Step 7: app.module.ts
Added `SyncModule` to imports in `server/src/app.module.ts`. All existing imports (ConfigModule.forRoot, MetaModule, AuthModule, APP_GUARD/JwtAuthGuard) preserved.

## Verification
- `cd server && npx nest build` completed successfully with no errors or warnings.
- Confirmed compiled output exists at `server/dist/sync/` (all 5 files: log-runner, materialize.service, sync.service, sync.controller, sync.module).

## Commit
- `bc18387` — "feat: sync module - push/pull + MaterializeService + LogRunner" (9 files changed, 214 insertions)

## Notes / Observations for Future Tasks
- The module relies on pre-existing enums/entities: `BusinessType` (incl. USER, ROOT, FUND_BOOK members used by MaterializeService), `OperateType` (incl. BATCH_CREATE, BATCH_DELETE), `SyncState` (SYNCED/UNSYNCED/FAILED), and `LogSync` fields (`operateData`, `businessId`, `businessType`, `operateType`, `syncState`, `materializedAt`, `materializeError`, `operatedAt`, `syncError`, `syncTime`). The clean compile confirms these all exist as referenced.
- `ConnectionManager.getDataSource` is now the public entry point for services needing raw DataSource access (used by MaterializeService); `getRepository` remains available for typed repo access.
- Pull dedup is id-based (`findOneBy({ id })`), so re-pulls of already-known changes are no-ops.
- The push endpoint expects main-server response shape `{ results: [{ logId, syncState, syncError }], commitId, syncTimeStamp }`; pull expects `{ changes: [], total }` (with or without an outer `data` envelope).
