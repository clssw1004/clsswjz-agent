# Task 5: Auth Module — Main-Server Login Proxy + JWT + Global Guard

## Status: Complete

## Summary
Created the auth module that delegates authentication to the main server and issues local JWTs. All 6 new files created, app.module.ts updated, build passes cleanly.

## Files Created

1. `server/src/auth/public.decorator.ts` — `@Public()` decorator to mark routes as exempt from JWT guard
2. `server/src/auth/jwt.strategy.ts` — Passport JWT strategy, reads secret from config, extracts `sub` as `userId`
3. `server/src/auth/jwt-auth.guard.ts` — Global guard that respects `@Public()` via Reflector
4. `server/src/auth/auth.service.ts` — Login flow: call main server POST `/api/auth/login`, upsert local user, init data dir, sign local JWT
5. `server/src/auth/auth.controller.ts` — `POST /auth/login` endpoint, marked `@Public()`
6. `server/src/auth/auth.module.ts` — Wires PassportModule, JwtModule (async from config), controller, service, strategy

## Files Modified

7. `server/src/app.module.ts` — Added AuthModule import and APP_GUARD provider for JwtAuthGuard

## Build
`npx nest build` completed with zero errors.

## Commit
`073c92e` — `feat: auth module - main-server login proxy + JWT + global guard`
