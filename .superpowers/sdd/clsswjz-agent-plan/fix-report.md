# Sync Module Fix Report

Date: 2026-08-22
Scope: 4 verified bugs in `server/src/sync` (materialize flush, pull field stripping, batchUpdate replay, operateData sanitization)

## Bug #1 (Critical): Materialize flush query never matches

- File: `server/src/sync/materialize.service.ts`
- Problem: flush queried `where: { syncState: SYNCED, materializedAt: 0 }`, generating SQL `materialized_at = 0`. The column is nullable and local/pulled logs store NULL, so the query returned 0 rows forever — nothing ever materialized into business tables.
- Fix: import `IsNull` from typeorm and query `where: { syncState: SyncState.SYNCED, materializedAt: IsNull() }`.
- Verified: in-memory SQLite test — old query returns 0 rows, new query returns the inserted NULL-materializedAt log.

## Bug #2 (Critical): Pulled logs keep server's materializedAt

- File: `server/src/sync/sync.service.ts` (`pull`)
- Problem: `logRepo.save(logRepo.create({ ...log, syncState: SYNCED }))` spread the server-side log object, which has `materializedAt` already set (the main server materializes its own copy). Pulled rows would be skipped by local flush even after fixing Bug #1, so pulled data never reached business tables.
- Fix: destructure out server-managed fields (`materializedAt`, `materializeError`) and explicitly construct the local row: `parentType ?? 'root'`, `parentId ?? 'None'`, `Number(operatedAt)`, `syncTime` defaulted to `Date.now()` when absent/non-positive, `syncState: SYNCED`. Only increment `totalPulled` for newly inserted ids (existing dedupe check kept).
- Verified: simulated pulled log with `materializedAt: 1724300010000` saved locally with `materializedAt === null`, `parentType='root'`, `parentId='None'`; the flush query (`IsNull()`) then finds both seeded local log and pulled log.

## Bug #3 (Important): LogRunner missing BATCH_UPDATE

- File: `server/src/sync/log-runner.ts`
- Problem: Flutter clients push `batchUpdate` operateType logs; replay silently skipped them (no case matched).
- Fix: added `OperateType.BATCH_UPDATE` case handling both payload shapes:
  - array of rows: `{ id, ...fields }` per row → `repo.update(id, fields)`
  - `{ ids: [], data: [] }`: pairs `ids[i]` with `data[i]` (object or empty)
  Both routes sanitize fields against entity columns (see Bug #4) and skip rows whose sanitized field set is empty.
- Verified: array form updated `description`; `{ids,data}` form updated `amount`.

## Bug #4 (Important): UPDATE replay crashes on unknown columns

- File: `server/src/sync/log-runner.ts`
- Problem: Flutter `operateData` uses e.g. `tagCodes` while the entity column is `tagCode`; TypeORM `update()`/`save()` throws on unknown properties, crashing materialization of the whole log.
- Fix: added private `sanitize(data, repo)` helper that keeps only keys matching `repo.metadata.columns[].propertyName`; applied to CREATE, BATCH_CREATE (each row when array), UPDATE fields, and BATCH_UPDATE fields. Note: main server does NOT convert tagCodes→tagCode either — it strips unknown columns, so stripping is protocol-consistent.
- Extra hardening beyond spec: empty-update guard — if sanitization removes every field, the update is skipped instead of letting TypeORM throw `UpdateValuesMissingError` (found empirically during runtime verification).
- Verified: UPDATE with `amount` + unknown `tagCodes` applies cleanly; CREATE with unknown `tagCodes` inserts cleanly with only known columns.

## Verification performed

1. `npx nest build` — passes clean (dist regenerated).
2. Runtime script (in-memory SQLite via sqlite3 + TypeORM, entities: LogSync + AccountItem, real compiled dist code incl. new LogRunner):
   - BUG1 old query rows: 0 / new query rows: 1
   - BUG2 pulled row materializedAt: null; parentType/parentId root/None; flush finds pulled log: true
   - BUG3 batch update applied: true (array form); ids/data form applied: true
   - BUG4 update sanitized+applied: true; create sanitized+applied: true
   All checks passed; temp script deleted after running.

## Files changed

- `server/src/sync/materialize.service.ts` — IsNull filter (+import)
- `server/src/sync/sync.service.ts` — pull() explicit clean-row construction
- `server/src/sync/log-runner.ts` — Repository import, sanitize helper, BATCH_UPDATE case, BATCH_CREATE per-row sanitize, empty-update guards on all update paths

Committed as: `fix: sync protocol - materialize NULL filter, pull field stripping, batchUpdate replay, operateData sanitization`
