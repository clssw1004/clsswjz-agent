# Task 2 Report: Core Infrastructure — Enums, ID Utility, ConnectionManager

## Status: COMPLETED

## Files Created

### Enums (6 files)
- `server/src/enums/business-type.enum.ts` — BusinessType enum with 12 values (item, book, bookMember, fundBook, fund, category, shop, symbol, user, attachment, note, root)
- `server/src/enums/operate-type.enum.ts` — OperateType enum with 6 values (update, create, delete, batchUpdate, batchCreate, batchDelete)
- `server/src/enums/sync-state.enum.ts` — SyncState enum with 4 values (unsynced, synced, syncing, failed)
- `server/src/enums/item-type.enum.ts` — ItemType enum with 2 values (INCOME, EXPENSE) — UPPERCASE as required
- `server/src/enums/symbol-type.enum.ts` — SymbolType enum with 2 values (TAG, PROJECT) — UPPERCASE as required
- `server/src/enums/currency.enum.ts` — Currency enum with 6 values (CNY=¥, USD=$, GBP=£, JPY=JPY¥, HKD=HK$, TWD=NT$)

### Core (3 files)
- `server/src/core/id.util.ts` — generateId() (32-char nanoid) and generateToken() (128-char nanoid) using alphabet `123456789abcdefghijkmnpqrstuvwxyz`
- `server/src/core/user-context.ts` — UserContext interface with userId, mainServerUrl, mainToken
- `server/src/core/connection-manager.ts` — @Injectable() ConnectionManager with:
  - `getRepository(userId, entity)` — returns TypeORM Repository
  - `initUserDataDir(userId)` — creates data/{userId}/ and data/{userId}/attachments/
  - Private `getConnection(userId)` — creates/caches DataSource per user
  - Uses ConfigService for dataPath

### Placeholder Entities (10 files)
Created minimal placeholder entity classes in `server/src/entities/` so ConnectionManager imports resolve:
- account-book.entity.ts, account-item.entity.ts, account-category.entity.ts
- account-fund.entity.ts, account-shop.entity.ts, account-symbol.entity.ts
- account-note.entity.ts, account-book-user.entity.ts, attachment.entity.ts
- log-sync.entity.ts

## Build Verification
- `npx nest build` completed successfully with zero errors
- All TypeScript compilation passed

## Commit
- Commit: `af72796` — "feat: core infrastructure - enums, ID util, ConnectionManager"

## Notes
- All enum string values exactly match the main server's values (lowercase for BusinessType/OperateType/SyncState, UPPERCASE for ItemType/SymbolType)
- nanoid alphabet correctly excludes ambiguous characters (0, O, l, I)
- Placeholder entity files will be replaced with real TypeORM entities in Task 3
- ConnectionManager structure is correct and ready for entity registration in Task 3
