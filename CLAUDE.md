# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

clsswjz-agent is a **sync replica** of a personal bookkeeping system — not a standalone app. It syncs data from a remote main server (clsswjz-server) via push/pull log-based replication, stores it in per-user SQLite databases, and serves a Vue 3 SPA. It's the web peer of the Flutter mobile client (clsswjz-gui).

## Commands

```bash
# Development (two terminals)
npm run start:dev        # Backend on :3001 (hot-reload)
npm run dev:web          # Frontend on :5173 (proxies /api to :3001)

# Build
npm run build            # NestJS → dist/
npm run build:web        # Vite → web/dist/
npm run start:prod       # node dist/main.js (serves SPA if web/dist exists)

# Tests (Jest + ts-jest)
npm test                 # Run all 91 tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
npx jest path/to/file.spec.ts   # Single test file
npx jest -t "test name"         # Single test by name

# Docker
docker compose up -d     # Build + run on :3001, mounts ./data
```

## Architecture

```
Browser (Vue 3) ←HTTPS→ clsswjz-agent (NestJS+SQLite) ←push/pull→ clsswjz-server (main)
```

### Two Separate Database Systems

- **`data/meta.db`** — Managed by `MetaModule` via standard TypeORM `@InjectRepository(MetaUser)`. Stores user connection info (mainServerUrl, mainToken).
- **`data/<userId>/db.sqlite`** — Per-user business database managed by `ConnectionManager`. Uses `this.connMgr.getRepository(userId, Entity)` — **not** `@InjectRepository`. There is NO global TypeORM connection for business entities.

### Adding a New Backend Module

Follow the CRUD + LogSync pattern (reference: `src/items/item.service.ts`):

1. Create `src/<module>/<module>.module.ts`, `controller.ts`, `service.ts`
2. Controller: `@UseGuards(JwtAuthGuard)`, extract `req.user.userId`
3. Service: `await this.connMgr.getRepository(userId, Entity)` for data access
4. Every write (create/update/delete) must also write a `LogSync` record:
   ```typescript
   const log = logRepo.create({
     businessType: BusinessType.XXX,
     operateType: OperateType.CREATE,  // or UPDATE/DELETE
     parentType: 'book', parentId: data.accountBookId,
     operatorId: userId, operatedAt: Date.now(),
     businessId: saved.id,
     operateData: JSON.stringify(saved),
     syncState: SyncState.UNSYNCED, syncTime: -1,
   });
   await logRepo.save(log);
   ```
5. Register in `src/app.module.ts`

### Sync Protocol (Log-Based Replication)

Every mutation creates a `LogSync` entry. The sync cycle:
- **Push**: Send UNSYNCED logs → main server, mark as SYNCED
- **Pull**: Fetch new logs from main server (by cursor), insert as SYNCED
- **Materialize**: Replay SYNCED logs that lack `materializedAt` via `LogRunner.runLogSync()`

`LogRunner` (`src/sync/log-runner.ts`) maps `BusinessType` → Entity via `TYPE_MAP`, handles all 6 operation types, with special logic for BOOK cascade delete, USER_SHARE/ITEM_RELATION upsert, and ITEM tag sync.

**Two-phase initial sync** (critical invariant): Phase 1 pulls only priority types (user/book/fund) but must NOT advance the sync cursor, so Phase 2 (delayed 3s) can pull all types from the same cursor. Violating this permanently skips non-priority data.

## Gotchas

- **Timestamps are epoch milliseconds** (`bigint`), not Date objects
- **IDs are 32-char nanoid** (alphabet: `123456789abcdefghijkmnpqrstuvwxyz`)
- **`synchronize: true`** everywhere — no migrations, TypeORM auto-alters tables
- **Response wrapper**: `TransformInterceptor` wraps all responses in `{ code: 0, data, message: 'ok' }`. Frontend unwraps via axios interceptor
- **TS is loosely configured**: `strictNullChecks: false`, `noImplicitAny: false`
- **`nest build` deletes dist/** before rebuilding (`deleteOutDir: true`)
- **Web is conditionally served**: `ServeStaticModule` only registers if `web/dist` exists on disk
- **`@Public()` decorator**: Only `POST /api/auth/login` opts out of JWT auth
- **Tags on items**: Multi-tags live in `item_rel_field` (fieldCode='TAG'), not on AccountItem directly. Both ItemService and LogRunner maintain this independently
- **LogRunner.sanitize()** silently drops fields not in the entity schema — entity columns are the source of truth during replay

## Git Branching Policy

**main is protected** — never develop features or fix bugs directly on main. Only these changes may be committed to main:

- Project-level config files (package.json deps, `.env.example`, `Dockerfile`/`.dockerignore`, nest/vite/tsconfig configs)
- Release operations (git tag, CHANGELOG updates)
- Documentation & CI (docs/, `.github/workflows/`)

All feature work goes on `feat/` branches, all bug fixes on `fix/` branches, merged into main via Pull Request (same convention as clsswjz-gui).

### Branch naming

- `feat/<module>-<short-desc>` — e.g. `feat/periods-gui-alignment`, `feat/web-panel-unify`
- `fix/<short-desc>` — e.g. `fix/swipe-delete-style`, `fix/login-host-check`

### Workflow

1. Branch from up-to-date main: `git checkout -b feat/xxx origin/main`
2. Commit with conventional messages (`feat:` / `fix:` / `refactor:` / `perf:` / `ci:` / `docs:` / `chore:`)
3. `git push origin feat/xxx` → open PR → review → merge into main

### Release

1. `git checkout main && git pull origin main`
2. Update `CHANGELOG.md` (if present) with user-facing changes; commit directly to main (release-only files)
3. Tag & push: `git tag vX.Y.Z && git push origin vX.Y.Z` — this triggers the `docker-publish` workflow (builds & pushes `clssw1004/clsswjz-agent`)
4. Version format: stable `x.y.z`, preview `x.y.z-alpha.n`

## Key Files

| File | Role |
|------|------|
| `src/app.module.ts` | Module registration, static serving, global guard/interceptor |
| `src/core/connection-manager.ts` | Per-user SQLite isolation (USER_ENTITIES, WAL, cached) |
| `src/sync/log-runner.ts` | Replay engine (TYPE_MAP, sanitize, cascade, tag sync) |
| `src/sync/sync.service.ts` | Push/pull orchestration, two-phase initial sync |
| `src/items/item.service.ts` | Reference CRUD + LogSync pattern |
| `src/entities/base.entity.ts` | Entity hierarchy (StringId → BaseEntity → BaseBusiness → WithAccountBook) |
| `src/periods/period-prediction.ts` | Period prediction algorithm (extracted for testability) |
| `web/src/api/index.ts` | All frontend API definitions |
| `web/vite.config.ts` | Dev proxy, manualChunks for echarts |
