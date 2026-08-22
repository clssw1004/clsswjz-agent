# Task 10 Report — Response Interceptor + Static File Serving

**Status: Complete** (with one necessary fix to a pre-existing blocker, documented below)

**Commit:** `d66e24e` — "feat: response interceptor + static file serving for Vue SPA"

## What Was Done

### 1. Created `server/src/interceptors/transform.interceptor.ts`
Exactly as specified: wraps every controller-route response as `{ code: 0, data, message: 'ok' }`.

### 2. Modified `server/src/app.module.ts`
- Imports added: `APP_INTERCEPTOR` (`@nestjs/core`), `ServeStaticModule` (`@nestjs/serve-static`), `join` (`path`), `CoreModule`, `TransformInterceptor`.
- **ServeStaticModule**: placed FIRST in imports (before all API modules so /api routes take priority):
  ```typescript
  ServeStaticModule.forRoot({
    rootPath: join(__dirname, 'public'),
    exclude: ['/api/(.*)'],
  }),
  ```
  Path note: verified the actual layout — `nest build` outputs flat to `dist/`, so compiled module is at `dist/app.module.js`; vite builds to `dist/public`. Therefore `join(__dirname, 'public')` is correct (the task's suggested `'..', 'public'` was NOT used; confirmed via grep on compiled output and live smoke test).
- **Providers**: added `{ provide: APP_INTERCEPTOR, useClass: TransformInterceptor }`. Interceptors only apply to controller routes, not ServeStaticModule or error filters, satisfying the "must NOT wrap static/error responses" requirement.

### 3. Fix for pre-existing boot blocker: created `server/src/core/core.module.ts`
The required verification ("server starts without errors") failed on unmodified code: `ConnectionManager` is `@Injectable()` but was never registered in any module, while services in 9 modules (sync, auth, items, books, categories, funds, shops, tags, projects, notes, attachments) inject it. This bug dates back to commit `af72796` (core infrastructure) and made the server unbootable regardless of Task 10 changes.

Fix: minimal global module providing one shared instance:
```typescript
@Global()
@Module({
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class CoreModule {}
```
Registered in `AppModule` imports after ConfigModule. A shared singleton matters here because `ConnectionManager` holds a per-user SQLite DataSource cache Map — per-module registrations would have fragmented that cache.

## Verification Results

1. `cd web && npx vite build` — success (builds to server/dist/public).
2. `npx nest build` — success.
   - Ordering caveat discovered: `nest-cli.json` has `deleteOutDir: true`, which wipes `dist/public`. Correct build order is `nest build` THEN `vite build`.
3. `timeout 8 node dist/main.js` — starts cleanly; all modules initialize, "Nest application successfully started", listening on :3001.
4. Live smoke tests (curl against running server):
   - `GET /` → 200, raw `text/html` (index.html served unwrapped by TransformInterceptor)
   - `POST /api/auth/login` with bad creds → raw Nest error body `{"message":..., "statusCode":401}` — errors NOT wrapped
   - `GET /api/items` without token → `{"message":"Unauthorized","statusCode":401}` unwrapped
   - `GET /some/spa/route` → 200 (SPA fallback works for client-side routes)
5. Committed with `git add -A && git commit`.

## Files Changed

- `server/src/interceptors/transform.interceptor.ts` (new)
- `server/src/core/core.module.ts` (new — boot fix)
- `server/src/app.module.ts` (modified)
- `.superpowers/sdd/clsswjz-agent-plan/task-9-report.md` (untracked file from prior task, swept into commit)
- `.superpowers/sdd/clsswjz-agent-plan/progress.md` (pre-existing modification, swept into commit)

## Note for Future Tasks

Build order for production: `npx nest build && cd ../web && npx vite build` — never the reverse, since nest build deletes dist/.
