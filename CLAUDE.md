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
npm test                 # Run all tests
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
- **`data/<hostDir>/<userId>/db.sqlite`** — Per-user business database managed by `ConnectionManager`. Data is isolated by main server host AND userId (different main servers with the same userId get separate databases). Uses `this.connMgr.getRepository(userId, Entity)` — **not** `@InjectRepository`. The host is resolved from `ConnectionManager.userHostMap` (a `userId → hostDir` map), **never** from request-scoped storage.

### Host-Based Data Isolation

`ConnectionManager` keeps a process-wide `userId → hostDir` map (`userHostMap`). `JwtStrategy.validate()` binds the token's `host` to `payload.sub` on every authenticated request; when an old token carries no `host`, `resolveHost(userId)` falls back to reading `mainServerUrl` from `data/meta.db` and caches the result. `getRepository()`, `getAttachmentsDir()`, `closeConnection()` and `resetUserDataDir()` all resolve the host this way, so every call routes to `data/<hostDir>/<userId>/` regardless of call stack.

> ⚠️ **Never reintroduce `AsyncLocalStorage` for the host.** It was the original design (commit `1f920f5`) and it failed silently: the ALS store written in `JwtStrategy.validate()` does not reliably reach the service layer through Nest's `guard → interceptor → handler` chain, so `host` was always `''` and every user's data collapsed into `data/<userId>/`. This was proven by signing a JWT with `host=bogushost-probe` — `/api/sync/status` returned 200 with normal data, yet `data/bogushost-probe/` was never created.

`hostDirFromUrl()` (`src/core/host.util.ts`) normalizes URLs: strips protocol, port and trailing slashes, then replaces unsafe chars with `_` (e.g. `http://192.168.1.100:3000` → `192.168.1.100`).

`migrateLegacyDir()` performs a one-shot, lossless rename of a legacy `data/<userId>/` directory into `data/<hostDir>/<userId>/` — only when the target database does not exist yet, and a failure never blocks startup.

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
- **Host isolation is keyed by `userId`, not request context**: always resolve the data directory through `ConnectionManager` (`getRepository` / `getAttachmentsDir`) — do not read a host from `AsyncLocalStorage` or from the incoming request. See *Host-Based Data Isolation* above
- **`synchronize: true`** everywhere — no migrations, TypeORM auto-alters tables
- **Response wrapper**: `TransformInterceptor` wraps all responses in `{ code: 0, data, message: 'ok' }`. Frontend unwraps via axios interceptor
- **TS is loosely configured**: `strictNullChecks: false`, `noImplicitAny: false`
- **`nest build` deletes dist/** before rebuilding (`deleteOutDir: true`)
- **Web is conditionally served**: `ServeStaticModule` only registers if `web/dist` exists on disk
- **`@Public()` decorator**: Only `POST /api/auth/login` opts out of JWT auth
- **Tags on items**: Multi-tags live in `item_rel_field` (fieldCode='TAG'), not on AccountItem directly — `AccountItem.tagCode` is a legacy column, never written by the agent (GUI's `toCreateCompanion` doesn't set it either). The item log protocol is the leaky part: `ItemService` always emits the full authoritative `tagCodes` (current state of `item_rel_field`, `[]` when none) and never emits `tagCode`; `LogRunner.syncItemTags` mirrors GUI — **CREATE only inserts, UPDATE unconditionally deletes then reinserts, and an UPDATE log with no tag field at all means "cleared"** (GUI omits `tagCodes` when the list is empty, so "both fields absent" is the only way it can say "no tags"). Changing either side alone breaks phone↔web tag convergence
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
   - PR create/merge can be automated via the Gitea API (credentials read from `git credential fill`, never hardcode tokens). See `docs/gitea_api_workflow.md`.

### Release

1. `git checkout main && git pull origin main`
2. Update `CHANGELOG.md` (if present) with user-facing changes; commit directly to main (release-only files)
3. Tag & push: `git tag vX.Y.Z && git push origin vX.Y.Z` — this triggers the `docker-publish` workflow (builds & pushes `clssw1004/clsswjz-agent`)
4. Optionally create the GitHub-style Release page via the Gitea API — see `docs/gitea_api_workflow.md`
5. Version format: stable `x.y.z`, preview `x.y.z-alpha.n`

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
