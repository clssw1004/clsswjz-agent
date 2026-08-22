# CLSSWJZ-Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone sync proxy service (NestJS + Vue 3 + SQLite) that acts as a third client node alongside iOS/Android, syncing with the main server via the log-based sync protocol.

**Architecture:** NestJS server with multi-tenant per-user SQLite databases, ConnectionManager for dynamic DB routing, log-based sync (push/pull) with the main server, and a Vue 3 + Element Plus responsive frontend. Authentication delegates to the main server — no local password storage.

**Tech Stack:** NestJS 10, TypeORM + SQLite3, Vue 3 + Element Plus + Vite + Pinia, JWT (@nestjs/jwt), nanoid, bcrypt (not for local use, but available), axios

**Spec:** `docs/superpowers/specs/2026-08-22-clsswjz-agent-design.md`

## Global Constraints

- Node.js ≥ 18, TypeScript ≥ 5.1
- NestJS 10.x, TypeORM 0.3.x, SQLite3
- Vue 3.5+, Element Plus 2.9+, Vite 6+, Pinia
- All primary keys: 32-char nanoid (alphabet: `123456789abcdefghijkmnpqrstuvwxyz`)
- Timestamps: bigint milliseconds (epoch)
- API prefix: `/api`
- JWT secret from env `JWT_SECRET` (required)
- Data directory from env or default `./data`
- No password storage in clsswjz-agent — auth delegated to main server

## File Structure

```
clsswjz-agent/
├── server/
│   ├── src/
│   │   ├── main.ts                              # Bootstrap, port config
│   │   ├── app.module.ts                        # Root module
│   │   ├── config/
│   │   │   └── configuration.ts                 # Env-based config
│   │   ├── core/
│   │   │   ├── connection-manager.ts             # Per-user TypeORM connection pool
│   │   │   ├── user-context.ts                   # Request-scoped user context
│   │   │   └── id.util.ts                        # nanoid 32-char PK generation
│   │   ├── meta/
│   │   │   ├── meta.module.ts                    # Global DB module
│   │   │   ├── meta.entity.ts                    # User entity (meta.db)
│   │   │   └── user.service.ts                   # User CRUD on meta.db
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts                # POST /api/auth/login
│   │   │   ├── auth.service.ts                   # Main-server login proxy + JWT
│   │   │   ├── jwt.strategy.ts                   # Passport JWT strategy
│   │   │   └── jwt-auth.guard.ts                 # Global guard
│   │   ├── sync/
│   │   │   ├── sync.module.ts
│   │   │   ├── sync.service.ts                   # Push/pull with main server
│   │   │   ├── materialize.service.ts            # Log replay into business tables
│   │   │   ├── log-runner.ts                     # Per-type entity dispatch
│   │   │   └── sync.controller.ts                # POST /api/sync/push, pull, status
│   │   ├── items/
│   │   │   ├── item.module.ts
│   │   │   ├── item.controller.ts
│   │   │   ├── item.service.ts
│   │   │   └── dto/
│   │   ├── books/
│   │   │   ├── book.module.ts
│   │   │   ├── book.controller.ts
│   │   │   └── book.service.ts
│   │   ├── categories/
│   │   │   ├── category.module.ts
│   │   │   ├── category.controller.ts
│   │   │   └── category.service.ts
│   │   ├── funds/
│   │   │   ├── fund.module.ts
│   │   │   ├── fund.controller.ts
│   │   │   └── fund.service.ts
│   │   ├── shops/
│   │   │   ├── shop.module.ts
│   │   │   ├── shop.controller.ts
│   │   │   └── shop.service.ts
│   │   ├── tags/
│   │   │   ├── tag.module.ts
│   │   │   ├── tag.controller.ts
│   │   │   └── tag.service.ts
│   │   ├── projects/
│   │   │   ├── project.module.ts
│   │   │   ├── project.controller.ts
│   │   │   └── project.service.ts
│   │   ├── notes/
│   │   │   ├── note.module.ts
│   │   │   ├── note.controller.ts
│   │   │   └── note.service.ts
│   │   ├── attachments/
│   │   │   ├── attachment.module.ts
│   │   │   ├── attachment.controller.ts
│   │   │   └── attachment.service.ts
│   │   ├── entities/                             # TypeORM entities (per-user SQLite)
│   │   │   ├── base.entity.ts
│   │   │   ├── log-sync.entity.ts
│   │   │   ├── account-book.entity.ts
│   │   │   ├── account-item.entity.ts
│   │   │   ├── account-category.entity.ts
│   │   │   ├── account-fund.entity.ts
│   │   │   ├── account-shop.entity.ts
│   │   │   ├── account-symbol.entity.ts
│   │   │   ├── account-note.entity.ts
│   │   │   ├── account-book-user.entity.ts
│   │   │   └── attachment.entity.ts
│   │   ├── enums/
│   │   │   ├── business-type.enum.ts
│   │   │   ├── operate-type.enum.ts
│   │   │   ├── sync-state.enum.ts
│   │   │   ├── item-type.enum.ts
│   │   │   ├── symbol-type.enum.ts
│   │   │   └── currency.enum.ts
│   │   └── interceptors/
│   │       └── transform.interceptor.ts          # Wrap response: { code, data, message }
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── web/
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router/index.ts
│   │   ├── api/
│   │   │   ├── http.ts                           # Axios instance
│   │   │   └── index.ts                          # API functions
│   │   ├── stores/
│   │   │   ├── auth.ts                           # Auth state + login/logout
│   │   │   └── app.ts                            # App state (books, current book)
│   │   ├── views/
│   │   │   ├── Login.vue
│   │   │   ├── Layout.vue
│   │   │   ├── ItemsView.vue
│   │   │   ├── ItemForm.vue
│   │   │   ├── Books.vue
│   │   │   ├── Notes.vue
│   │   │   ├── NoteForm.vue
│   │   │   └── settings/
│   │   │       ├── Categories.vue
│   │   │       ├── Shops.vue
│   │   │       ├── Tags.vue
│   │   │       ├── Projects.vue
│   │   │       └── Funds.vue
│   │   ├── composables/
│   │   │   └── useResponsive.ts
│   │   └── styles/
│   │       ├── tokens.css
│   │       └── themes.ts
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json                                   # Monorepo root
└── tsconfig.json                                  # Root TS config
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (root), `tsconfig.json` (root), `.gitignore`, `.env.example`
- Create: `server/package.json`, `server/tsconfig.json`, `server/tsconfig.build.json`, `server/nest-cli.json`
- Create: `server/src/main.ts`, `server/src/app.module.ts`, `server/src/config/configuration.ts`
- Create: `web/package.json`, `web/vite.config.ts`, `web/index.html`, `web/tsconfig.json`
- Create: `web/src/main.ts`, `web/src/App.vue`, `web/src/router/index.ts`
- Create: `Dockerfile`, `docker-compose.yml`

**Interfaces:**
- Consumes: none
- Produces: runnable NestJS server on port 3001, runnable Vue dev server on port 5173

- [ ] **Step 1: Init root package.json**

```json
{
  "name": "clsswjz-agent",
  "private": true,
  "scripts": {
    "dev:server": "cd server && npm run start:dev",
    "dev:web": "cd web && npm run dev",
    "build": "cd server && npm run build && cd ../web && npm run build",
    "start": "cd server && npm run start:prod"
  }
}
```

- [ ] **Step 2: Init server package.json with dependencies**

```json
{
  "name": "clsswjz-agent-server",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.9",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/serve-static": "^4.0.2",
    "@nestjs/typeorm": "^10.0.2",
    "@types/multer": "^1.4.12",
    "axios": "^1.7.9",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "nanoid": "^3.3.8",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1",
    "sqlite3": "^5.1.7",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^5.0.0",
    "@types/node": "^20.3.1",
    "@types/passport-jwt": "^4.0.1",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.3"
  }
}
```

- [ ] **Step 3: Create server tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": { "src/*": ["src/*"] }
  }
}
```

- [ ] **Step 4: Create server nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create server src/main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const port = process.env.SERVER_PORT || 3001;
  await app.listen(port);
  console.log(`clsswjz-agent running on :${port}`);
}
bootstrap();
```

- [ ] **Step 6: Create server src/config/configuration.ts**

```typescript
export default () => ({
  port: parseInt(process.env.SERVER_PORT || '3001', 10),
  dataPath: process.env.DATA_PATH || './data',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  sync: {
    interval: parseInt(process.env.SYNC_INTERVAL || '300000', 10),
  },
});
```

- [ ] **Step 7: Create server src/app.module.ts (minimal stub)**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Install server dependencies and verify build**

```bash
cd server && npm install && npx nest build
```

Expected: successful build, no errors.

- [ ] **Step 9: Init web directory with Vue 3 + Element Plus + Vite**

```bash
cd web && npm init -y
npm install vue vue-router@4 element-plus axios pinia @element-plus/icons-vue
npm install -D @vitejs/plugin-vue vite typescript
```

- [ ] **Step 10: Create web/index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>记账助手</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 11: Create web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: { outDir: '../server/dist/public' },
});
```

- [ ] **Step 12: Create web/src/main.ts, App.vue, router/index.ts (stubs)**

```typescript
// web/src/main.ts
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

createApp(App).use(createPinia()).use(router).use(ElementPlus).mount('#app');
```

```vue
<!-- web/src/App.vue -->
<template><router-view /></template>
```

```typescript
// web/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
export default createRouter({
  history: createWebHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: () => import('../views/Login.vue') }],
});
```

```vue
<!-- web/src/views/Login.vue (stub) -->
<template><div>Login stub</div></template>
```

- [ ] **Step 13: Create .env.example and .gitignore**

```
# .env.example
SERVER_PORT=3001
DATA_PATH=./data
JWT_SECRET=change-me-to-a-random-string
JWT_EXPIRES_IN=24h
SYNC_INTERVAL=300000
```

```
# .gitignore
node_modules/
dist/
data/
.env
*.sqlite
```

- [ ] **Step 14: Create Dockerfile and docker-compose.yml**

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY server/ server/
RUN cd server && npm install && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

```yaml
# docker-compose.yml
services:
  agent:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - SERVER_PORT=3001
      - JWT_SECRET=${JWT_SECRET:-change-me}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

- [ ] **Step 15: Commit**

```bash
git init && git add -A && git commit -m "feat: project scaffolding - NestJS server + Vue 3 web"
```

---

## Task 2: Core Infrastructure — Enums, ID Utility, ConnectionManager

**Files:**
- Create: `server/src/enums/business-type.enum.ts`
- Create: `server/src/enums/operate-type.enum.ts`
- Create: `server/src/enums/sync-state.enum.ts`
- Create: `server/src/enums/item-type.enum.ts`
- Create: `server/src/enums/symbol-type.enum.ts`
- Create: `server/src/enums/currency.enum.ts`
- Create: `server/src/core/id.util.ts`
- Create: `server/src/core/connection-manager.ts`
- Create: `server/src/core/user-context.ts`

**Interfaces:**
- Consumes: `config/configuration.ts` (dataPath)
- Produces: `ConnectionManager.getRepository(userId, Entity)`, `generateId()`, `UserContext` type

- [ ] **Step 1: Create all enum files**

Copy enum values from `clsswjz-server/src/pojo/enums/` with exact string literals:

```typescript
// server/src/enums/business-type.enum.ts
export enum BusinessType {
  ITEM = 'item',
  BOOK = 'book',
  BOOK_MEMBER = 'bookMember',
  FUND_BOOK = 'fundBook',
  FUND = 'fund',
  CATEGORY = 'category',
  SHOP = 'shop',
  SYMBOL = 'symbol',
  USER = 'user',
  ATTACHMENT = 'attachment',
  NOTE = 'note',
  ROOT = 'root',
}
```

```typescript
// server/src/enums/operate-type.enum.ts
export enum OperateType {
  UPDATE = 'update',
  CREATE = 'create',
  DELETE = 'delete',
  BATCH_UPDATE = 'batchUpdate',
  BATCH_CREATE = 'batchCreate',
  BATCH_DELETE = 'batchDelete',
}
```

```typescript
// server/src/enums/sync-state.enum.ts
export enum SyncState {
  UNSYNCED = 'unsynced',
  SYNCED = 'synced',
  SYNCING = 'syncing',
  FAILED = 'failed',
}
```

```typescript
// server/src/enums/item-type.enum.ts
export enum ItemType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}
```

```typescript
// server/src/enums/symbol-type.enum.ts
export enum SymbolType {
  TAG = 'TAG',
  PROJECT = 'PROJECT',
}
```

```typescript
// server/src/enums/currency.enum.ts
export enum Currency {
  CNY = '¥',
  USD = '$',
  GBP = '£',
  JPY = 'JPY¥',
  HKD = 'HK$',
  TWD = 'NT$',
}
```

- [ ] **Step 2: Create server/src/core/id.util.ts**

```typescript
import { customAlphabet } from 'nanoid';

const ALPHABET = '123456789abcdefghijkmnpqrstuvwxyz';
const nanoid = customAlphabet(ALPHABET);

export function generateId(): string {
  return nanoid(32);
}

export function generateToken(): string {
  return nanoid(128);
}
```

- [ ] **Step 3: Create server/src/core/user-context.ts**

```typescript
export interface UserContext {
  userId: string;
  mainServerUrl: string;
  mainToken: string;
}
```

- [ ] **Step 4: Create server/src/core/connection-manager.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { LogSync } from '../entities/log-sync.entity';
import { AccountBook } from '../entities/account-book.entity';
import { AccountItem } from '../entities/account-item.entity';
import { AccountCategory } from '../entities/account-category.entity';
import { AccountFund } from '../entities/account-fund.entity';
import { AccountShop } from '../entities/account-shop.entity';
import { AccountSymbol } from '../entities/account-symbol.entity';
import { AccountNote } from '../entities/account-note.entity';
import { AccountBookUser } from '../entities/account-book-user.entity';
import { AttachmentEntity } from '../entities/attachment.entity';

const USER_ENTITIES = [
  AccountBook, AccountItem, AccountCategory, AccountFund,
  AccountShop, AccountSymbol, AccountNote, AccountBookUser,
  AttachmentEntity, LogSync,
];

@Injectable()
export class ConnectionManager {
  private connections = new Map<string, DataSource>();
  private dataPath: string;

  constructor(private config: ConfigService) {
    this.dataPath = config.get<string>('dataPath') || './data';
  }

  async getRepository<T extends ObjectLiteral>(
    userId: string,
    entity: new () => T,
  ): Promise<Repository<T>> {
    const ds = await this.getConnection(userId);
    return ds.getRepository(entity);
  }

  async initUserDataDir(userId: string): Promise<void> {
    const userDir = path.join(this.dataPath, userId);
    const attachDir = path.join(userDir, 'attachments');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
  }

  private async getConnection(userId: string): Promise<DataSource> {
    if (this.connections.has(userId)) {
      const ds = this.connections.get(userId)!;
      if (ds.isInitialized) return ds;
    }
    await this.initUserDataDir(userId);
    const dbPath = path.join(this.dataPath, userId, 'db.sqlite');
    const ds = new DataSource({
      type: 'sqlite',
      database: dbPath,
      entities: USER_ENTITIES,
      synchronize: true,
    });
    await ds.initialize();
    this.connections.set(userId, ds);
    return ds;
  }

  async closeConnection(userId: string): Promise<void> {
    const ds = this.connections.get(userId);
    if (ds?.isInitialized) {
      await ds.destroy();
      this.connections.delete(userId);
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: core infrastructure - enums, ID util, ConnectionManager"
```

---

## Task 3: Entity Definitions

**Files:**
- Create: `server/src/entities/base.entity.ts`
- Create: `server/src/entities/log-sync.entity.ts`
- Create: `server/src/entities/account-book.entity.ts`
- Create: `server/src/entities/account-item.entity.ts`
- Create: `server/src/entities/account-category.entity.ts`
- Create: `server/src/entities/account-fund.entity.ts`
- Create: `server/src/entities/account-shop.entity.ts`
- Create: `server/src/entities/account-symbol.entity.ts`
- Create: `server/src/entities/account-note.entity.ts`
- Create: `server/src/entities/account-book-user.entity.ts`
- Create: `server/src/entities/attachment.entity.ts`

**Interfaces:**
- Consumes: enums from Task 2
- Produces: all TypeORM entity classes used by ConnectionManager and LogRunner

- [ ] **Step 1: Create base entities**

```typescript
// server/src/entities/base.entity.ts
import { PrimaryColumn, Column, BeforeInsert, BeforeUpdate } from 'typeorm';
import { generateId } from '../core/id.util';

export abstract class StringIdEntity {
  @PrimaryColumn({ length: 32 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = generateId();
  }
}

export abstract class BaseEntity extends StringIdEntity {
  @Column({ type: 'bigint', default: 0 })
  createdAt: number;

  @Column({ type: 'bigint', default: 0 })
  updatedAt: number;

  @BeforeInsert()
  setTimestamps() {
    const now = Date.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = Date.now();
  }
}

export abstract class BaseBusinessEntity extends BaseEntity {
  @Column({ length: 32, default: '' })
  createdBy: string;

  @Column({ length: 32, default: '' })
  updatedBy: string;
}

export abstract class BaseBusinessEntityWithAccountBook extends BaseBusinessEntity {
  @Column({ length: 32, default: '' })
  accountBookId: string;
}
```

- [ ] **Step 2: Create LogSync entity**

```typescript
// server/src/entities/log-sync.entity.ts
import { Entity, Column, Unique } from 'typeorm';
import { StringIdEntity } from './base.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Entity('log_sync')
@Unique(['parentType', 'parentId', 'businessType', 'businessId', 'operatorId', 'operatedAt'])
export class LogSync extends StringIdEntity {
  @Column({ type: 'varchar', length: 32 })
  businessType: BusinessType;

  @Column({ type: 'varchar', length: 32 })
  operateType: OperateType;

  @Column({ type: 'varchar', length: 32, nullable: true })
  parentType: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  parentId: string;

  @Column({ type: 'varchar', length: 32 })
  operatorId: string;

  @Column({ type: 'bigint' })
  operatedAt: number;

  @Column({ type: 'varchar', length: 32 })
  businessId: string;

  @Column({ type: 'text', nullable: true })
  operateData: string;

  @Column({ type: 'varchar', length: 32, default: SyncState.UNSYNCED })
  syncState: SyncState;

  @Column({ type: 'bigint', nullable: true })
  syncTime: number;

  @Column({ type: 'text', nullable: true })
  syncError: string;

  @Column({ type: 'bigint', nullable: true })
  materializedAt: number;

  @Column({ type: 'text', nullable: true })
  materializeError: string;
}
```

- [ ] **Step 3: Create all business entities**

Create each entity matching the main server's schema exactly. Example for AccountItem:

```typescript
// server/src/entities/account-item.entity.ts
import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';
import { ItemType } from '../enums/item-type.enum';

@Entity('account_items')
export class AccountItem extends BaseBusinessEntityWithAccountBook {
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 10, default: ItemType.EXPENSE })
  type: ItemType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoryCode: string;

  @Column({ type: 'varchar', length: 32 })
  accountDate: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fundId: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shopCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tagCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  projectCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  source: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sourceId: string;
}
```

Create the remaining entities following the same pattern, matching main server field types exactly:

- **AccountBook**: name(50), description(200), defaultFundId(32), currencySymbol, icon
- **AccountCategory**: name(128), code(16), categoryType(ItemType), accountBookId, lastAccountItemAt
- **AccountFund**: name(50), fundType(20), fundRemark, fundBalance(decimal), isDefault(bool), accountBookId
- **AccountShop**: name(128), code(16), accountBookId
- **AccountSymbol**: name(128), code(16), symbolType(SymbolType), accountBookId
- **AccountNote**: title(200), content(text), noteType(20), groupCode(50), scope(20), template(text), accountBookId
- **AccountBookUser**: userId(32), accountBookId(32), canViewBook(bool), canEditBook(bool), canDeleteBook(bool), canViewItem(bool), canEditItem(bool), canDeleteItem(bool)
- **AttachmentEntity** (extends BaseBusinessEntity): originName, fileLength(number), extension(20), contentType(100), businessCode(20), businessId(32)

- [ ] **Step 4: Verify entities compile**

```bash
cd server && npx nest build
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: TypeORM entities for user-level SQLite databases"
```

---

## Task 4: Meta Database — User Entity + Service

**Files:**
- Create: `server/src/meta/meta.entity.ts`
- Create: `server/src/meta/user.service.ts`
- Create: `server/src/meta/meta.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `id.util.ts`, `ConfigService`
- Produces: `UserService.findById(id)`, `UserService.upsertUser(data)`, `UserService` (global)

- [ ] **Step 1: Create meta.db User entity**

```typescript
// server/src/meta/meta.entity.ts
import { Entity, Column, PrimaryColumn, BeforeInsert, BeforeUpdate } from 'typeorm';

@Entity('users')
export class MetaUser {
  @PrimaryColumn({ length: 32 })
  id: string;

  @Column({ length: 50, default: '' })
  nickname: string;

  @Column({ length: 255, default: '' })
  mainServerUrl: string;

  @Column({ type: 'text', default: '' })
  mainToken: string;

  @Column({ type: 'bigint', default: 0 })
  createdAt: number;

  @Column({ type: 'bigint', default: 0 })
  updatedAt: number;

  @BeforeInsert()
  setTimestamps() {
    const now = Date.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = Date.now();
  }
}
```

- [ ] **Step 2: Create UserService**

```typescript
// server/src/meta/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaUser } from './meta.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(MetaUser)
    private readonly userRepo: Repository<MetaUser>,
  ) {}

  async findById(id: string): Promise<MetaUser | null> {
    return this.userRepo.findOneBy({ id });
  }

  async upsertUser(data: {
    id: string;
    nickname: string;
    mainServerUrl: string;
    mainToken: string;
  }): Promise<MetaUser> {
    let user = await this.userRepo.findOneBy({ id: data.id });
    if (user) {
      user.nickname = data.nickname;
      user.mainServerUrl = data.mainServerUrl;
      user.mainToken = data.mainToken;
    } else {
      user = this.userRepo.create(data);
    }
    return this.userRepo.save(user);
  }
}
```

- [ ] **Step 3: Create MetaModule**

```typescript
// server/src/meta/meta.module.ts
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MetaUser } from './meta.entity';
import { UserService } from './user.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: `${config.get('dataPath') || './data'}/meta.db`,
        entities: [MetaUser],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([MetaUser]),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class MetaModule {}
```

- [ ] **Step 4: Update app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { MetaModule } from './meta/meta.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MetaModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Build and verify meta.db creation**

```bash
cd server && npx nest build && node dist/main.js &
sleep 3 && ls data/meta.db && kill %1
```

Expected: `data/meta.db` file exists.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: meta database - User entity and UserService for global user store"
```

---

## Task 5: Auth Module — Login + JWT + Guard

**Files:**
- Create: `server/src/auth/auth.module.ts`
- Create: `server/src/auth/jwt.strategy.ts`
- Create: `server/src/auth/jwt-auth.guard.ts`
- Create: `server/src/auth/auth.service.ts`
- Create: `server/src/auth/auth.controller.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `UserService` (Task 4), `id.util.generateToken()` (Task 2), main server `POST {host}/api/auth/login`
- Produces: `POST /api/auth/login` → returns `{ access_token, userId, nickname }`, `JwtAuthGuard` (global)

- [ ] **Step 1: Create JwtStrategy**

```typescript
// server/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.secret'),
    });
  }

  async validate(payload: { sub: string }) {
    return { userId: payload.sub };
  }
}
```

- [ ] **Step 2: Create JwtAuthGuard**

```typescript
// server/src/auth/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

Create `server/src/auth/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 3: Create AuthService**

```typescript
// server/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UserService } from '../meta/user.service';
import { ConnectionManager } from '../core/connection-manager';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private userService: UserService,
    private connMgr: ConnectionManager,
  ) {}

  async login(body: {
    mainServerUrl: string;
    username: string;
    password: string;
  }) {
    const { mainServerUrl, username, password } = body;

    // 1. Call main server login
    let mainResponse: any;
    try {
      const resp = await axios.post(`${mainServerUrl}/api/auth/login`, {
        username,
        password,
      });
      mainResponse = resp.data?.data || resp.data;
    } catch (err) {
      throw new UnauthorizedException('主端认证失败: ' + (err.response?.data?.message || err.message));
    }

    if (!mainResponse?.access_token) {
      throw new UnauthorizedException('主端未返回 token');
    }

    // 2. Upsert local user record
    const user = await this.userService.upsertUser({
      id: mainResponse.userId,
      nickname: mainResponse.nickname || mainResponse.username,
      mainServerUrl,
      mainToken: mainResponse.access_token,
    });

    // 3. Init user data directory
    await this.connMgr.initUserDataDir(user.id);

    // 4. Sign local JWT
    const access_token = this.jwtService.sign({ sub: user.id });

    return {
      access_token,
      userId: user.id,
      nickname: user.nickname,
    };
  }
}
```

- [ ] **Step 4: Create AuthController**

```typescript
// server/src/auth/auth.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: { mainServerUrl: string; username: string; password: string }) {
    return this.authService.login(body);
  }
}
```

- [ ] **Step 5: Create AuthModule**

```typescript
// server/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 6: Register global guard in app.module.ts**

Update `app.module.ts` to add AuthModule and global guard:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { MetaModule } from './meta/meta.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MetaModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Test login flow manually**

Start server, call `POST /api/auth/login` with a valid main server:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mainServerUrl":"http://your-main-server:3000","username":"test","password":"test123"}'
```

Expected: `{ "access_token": "...", "userId": "...", "nickname": "..." }`

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: auth module - main-server login proxy + JWT + global guard"
```

---

## Task 6: Sync Module — Push/Pull + MaterializeService + LogRunner

**Files:**
- Create: `server/src/sync/sync.module.ts`
- Create: `server/src/sync/sync.service.ts`
- Create: `server/src/sync/materialize.service.ts`
- Create: `server/src/sync/log-runner.ts`
- Create: `server/src/sync/sync.controller.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `ConnectionManager` (Task 2), `UserService` (Task 4), all entities (Task 3), enums (Task 2)
- Produces: `POST /api/sync/push`, `POST /api/sync/pull`, `GET /api/sync/status`, `MaterializeService.flush(userId)`

- [ ] **Step 1: Create LogRunner**

```typescript
// server/src/sync/log-runner.ts
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { AccountBook } from '../entities/account-book.entity';
import { AccountItem } from '../entities/account-item.entity';
import { AccountCategory } from '../entities/account-category.entity';
import { AccountFund } from '../entities/account-fund.entity';
import { AccountShop } from '../entities/account-shop.entity';
import { AccountSymbol } from '../entities/account-symbol.entity';
import { AccountNote } from '../entities/account-note.entity';
import { AccountBookUser } from '../entities/account-book-user.entity';
import { AttachmentEntity } from '../entities/attachment.entity';

const TYPE_MAP: Record<string, any> = {
  [BusinessType.BOOK]: AccountBook,
  [BusinessType.ITEM]: AccountItem,
  [BusinessType.CATEGORY]: AccountCategory,
  [BusinessType.FUND]: AccountFund,
  [BusinessType.SHOP]: AccountShop,
  [BusinessType.SYMBOL]: AccountSymbol,
  [BusinessType.NOTE]: AccountNote,
  [BusinessType.BOOK_MEMBER]: AccountBookUser,
  [BusinessType.ATTACHMENT]: AttachmentEntity,
};

@Injectable()
export class LogRunner {
  async runLogSync(log: LogSync, ds: DataSource): Promise<void> {
    const EntityClass = TYPE_MAP[log.businessType];
    if (!EntityClass) return; // root, fundBook, user — skip

    const repo = ds.getRepository(EntityClass);
    const data = log.operateData ? JSON.parse(log.operateData) : null;

    switch (log.operateType) {
      case OperateType.CREATE:
      case OperateType.BATCH_CREATE:
        if (data) await repo.save(data);
        break;
      case OperateType.UPDATE:
        if (data) {
          const { id, ...fields } = data;
          await repo.update(log.businessId, fields);
        }
        break;
      case OperateType.DELETE:
        await repo.delete(log.businessId);
        break;
      case OperateType.BATCH_DELETE:
        if (data?.ids) await repo.delete(data.ids);
        else await repo.delete(log.businessId);
        break;
    }
  }
}
```

- [ ] **Step 2: Create MaterializeService**

```typescript
// server/src/sync/materialize.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LogSync } from '../entities/log-sync.entity';
import { SyncState } from '../enums/sync-state.enum';
import { BusinessType } from '../enums/business-type.enum';
import { LogRunner } from './log-runner';
import { ConnectionManager } from '../core/connection-manager';

@Injectable()
export class MaterializeService {
  private readonly logger = new Logger(MaterializeService.name);
  private flushPromises = new Map<string, Promise<void>>();

  constructor(
    private logRunner: LogRunner,
    private connMgr: ConnectionManager,
  ) {}

  async flush(userId: string): Promise<void> {
    if (this.flushPromises.has(userId)) return this.flushPromises.get(userId);
    const p = this.doFlush(userId);
    this.flushPromises.set(userId, p);
    try { await p; } finally { this.flushPromises.delete(userId); }
  }

  private async doFlush(userId: string): Promise<void> {
    const ds = await (this.connMgr as any).getConnection(userId);
    const logRepo = ds.getRepository(LogSync);
    const BATCH = 100;

    let processed = 0;
    while (true) {
      const logs = await logRepo.find({
        where: { syncState: SyncState.SYNCED, materializedAt: 0 as any },
        order: { operatedAt: 'ASC' },
        take: BATCH,
      });
      if (logs.length === 0) break;

      for (const log of logs) {
        try {
          if (log.businessType === BusinessType.USER || log.businessType === BusinessType.ROOT || log.businessType === BusinessType.FUND_BOOK) {
            await logRepo.update(log.id, { materializedAt: Date.now() });
          } else {
            await this.logRunner.runLogSync(log, ds);
            await logRepo.update(log.id, { materializedAt: Date.now() });
          }
          processed++;
        } catch (err) {
          await logRepo.update(log.id, {
            materializeError: String(err),
          });
          this.logger.warn(`Materialize failed for log ${log.id}: ${err}`);
        }
      }
      if (logs.length < BATCH) break;
    }
    if (processed > 0) this.logger.log(`Materialized ${processed} logs for user ${userId}`);
  }
}
```

- [ ] **Step 3: Create SyncService**

```typescript
// server/src/sync/sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConnectionManager } from '../core/connection-manager';
import { UserService } from '../meta/user.service';
import { LogSync } from '../entities/log-sync.entity';
import { SyncState } from '../enums/sync-state.enum';
import { generateId } from '../core/id.util';
import { MaterializeService } from './materialize.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private connMgr: ConnectionManager,
    private userService: UserService,
    private materialize: MaterializeService,
  ) {}

  async push(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');

    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const unsyncedLogs = await logRepo.find({
      where: { syncState: SyncState.UNSYNCED },
      order: { operatedAt: 'ASC' },
    });

    if (unsyncedLogs.length === 0) return { pushed: 0 };

    try {
      const resp = await axios.post(`${user.mainServerUrl}/api/sync/push`, {
        logs: unsyncedLogs,
      }, {
        headers: { Authorization: `Bearer ${user.mainToken}` },
      });

      const result = resp.data?.data || resp.data;

      // Update local sync states
      for (const r of result.results || []) {
        await logRepo.update(r.logId, {
          syncState: r.syncState === 'synced' ? SyncState.SYNCED : SyncState.FAILED,
          syncError: r.syncError || null,
          syncTime: result.syncTimeStamp,
        });
      }

      return { pushed: unsyncedLogs.length, commitId: result.commitId };
    } catch (err) {
      this.logger.error(`Push failed for user ${userId}: ${err.message}`);
      throw err;
    }
  }

  async pull(userId: string, commitId?: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');

    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const lastSynced = await logRepo.findOne({
      where: { syncState: SyncState.SYNCED },
      order: { syncTime: 'DESC' },
    });
    const syncTimeStamp = lastSynced?.syncTime || 0;

    let page = 1;
    let totalPulled = 0;

    while (true) {
      try {
        const resp = await axios.post(`${user.mainServerUrl}/api/sync/pull`, {
          syncTimeStamp,
          page,
          pageSize: 1000,
          commitId,
        }, {
          headers: { Authorization: `Bearer ${user.mainToken}` },
        });

        const result = resp.data?.data || resp.data;
        const changes = result.changes || [];

        for (const log of changes) {
          const exists = await logRepo.findOneBy({ id: log.id });
          if (!exists) {
            await logRepo.save(logRepo.create({ ...log, syncState: SyncState.SYNCED }));
            totalPulled++;
          }
        }

        if (totalPulled >= result.total || changes.length === 0) break;
        page++;
      } catch (err) {
        this.logger.error(`Pull failed for user ${userId}: ${err.message}`);
        throw err;
      }
    }

    // Materialize pulled logs
    if (totalPulled > 0) {
      await this.materialize.flush(userId);
    }

    return { pulled: totalPulled };
  }

  async getStatus(userId: string) {
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const unsynced = await logRepo.countBy({ syncState: SyncState.UNSYNCED });
    const failed = await logRepo.countBy({ syncState: SyncState.FAILED });
    return { unsynced, failed };
  }
}
```

- [ ] **Step 4: Create SyncController**

```typescript
// server/src/sync/sync.controller.ts
import { Controller, Post, Get, Req, Body } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('push')
  async push(@Req() req) {
    return this.syncService.push(req.user.userId);
  }

  @Post('pull')
  async pull(@Req() req, @Body() body: { commitId?: string }) {
    return this.syncService.pull(req.user.userId, body.commitId);
  }

  @Get('status')
  async status(@Req() req) {
    return this.syncService.getStatus(req.user.userId);
  }
}
```

- [ ] **Step 5: Create SyncModule and register in AppModule**

```typescript
// server/src/sync/sync.module.ts
import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { MaterializeService } from './materialize.service';
import { LogRunner } from './log-runner';
import { SyncController } from './sync.controller';

@Module({
  controllers: [SyncController],
  providers: [SyncService, MaterializeService, LogRunner],
  exports: [SyncService],
})
export class SyncModule {}
```

Add `SyncModule` to `app.module.ts` imports.

- [ ] **Step 6: Build and verify**

```bash
cd server && npx nest build
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: sync module - push/pull with main server + MaterializeService + LogRunner"
```

---

## Task 7: Item Service + Controller (Core Bookkeeping CRUD)

**Files:**
- Create: `server/src/items/item.module.ts`
- Create: `server/src/items/item.service.ts`
- Create: `server/src/items/item.controller.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `ConnectionManager` (Task 2), `UserService` (Task 4), `AccountItem` entity (Task 3), `LogSync` entity (Task 3)
- Produces: `GET/POST/PUT/DELETE /api/items`, `ItemService`

- [ ] **Step 1: Create ItemService**

```typescript
// server/src/items/item.service.ts
import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountItem } from '../entities/account-item.entity';
import { LogSync } from '../entities/log-sync.entity';
import { generateId } from '../core/id.util';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class ItemService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: {
    accountBookId?: string;
    type?: string;
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const { accountBookId, type, page = 1, pageSize = 20, startDate, endDate } = query;

    const qb = repo.createQueryBuilder('item');
    if (accountBookId) qb.andWhere('item.accountBookId = :accountBookId', { accountBookId });
    if (type) qb.andWhere('item.type = :type', { type });
    if (startDate) qb.andWhere('item.accountDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('item.accountDate <= :endDate', { endDate });

    const total = await qb.getCount();
    const items = await qb.orderBy('item.accountDate', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { items, total, page, pageSize };
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<AccountItem>) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);

    const item = repo.create({ ...data, createdBy: userId, updatedBy: userId });
    const saved = await repo.save(item);

    const log = logRepo.create({
      businessType: BusinessType.ITEM,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: data.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: saved.id,
      operateData: JSON.stringify(saved),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    });
    await logRepo.save(log);

    return saved;
  }

  async update(userId: string, id: string, data: Partial<AccountItem>) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);

    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });

    const log = logRepo.create({
      businessType: BusinessType.ITEM,
      operateType: OperateType.UPDATE,
      parentType: 'book',
      parentId: updated?.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      operateData: JSON.stringify({ id, ...data }),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    });
    await logRepo.save(log);

    return updated;
  }

  async remove(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);

    const item = await repo.findOneBy({ id });
    await repo.delete(id);

    const log = logRepo.create({
      businessType: BusinessType.ITEM,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: item?.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    });
    await logRepo.save(log);

    return { deleted: true };
  }
}
```

- [ ] **Step 2: Create ItemController**

```typescript
// server/src/items/item.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ItemService } from './item.service';

@Controller('items')
export class ItemController {
  constructor(private itemService: ItemService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.itemService.findAll(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.itemService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.itemService.create(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.itemService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.itemService.remove(req.user.userId, id);
  }
}
```

- [ ] **Step 3: Create ItemModule and register in AppModule**

```typescript
// server/src/items/item.module.ts
import { Module } from '@nestjs/common';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';

@Module({
  controllers: [ItemController],
  providers: [ItemService],
})
export class ItemModule {}
```

Add `ItemModule` to `app.module.ts`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: item module - CRUD with log-based sync write"
```

---

## Task 8: Remaining Business Modules (Books, Categories, Funds, Shops, Tags, Projects, Notes)

**Files:**
- Create: `server/src/books/book.module.ts`, `book.controller.ts`, `book.service.ts`
- Create: `server/src/categories/category.module.ts`, `category.controller.ts`, `category.service.ts`
- Create: `server/src/funds/fund.module.ts`, `fund.controller.ts`, `fund.service.ts`
- Create: `server/src/shops/shop.module.ts`, `shop.controller.ts`, `shop.service.ts`
- Create: `server/src/tags/tag.module.ts`, `tag.controller.ts`, `tag.service.ts`
- Create: `server/src/projects/project.module.ts`, `project.controller.ts`, `project.service.ts`
- Create: `server/src/notes/note.module.ts`, `note.controller.ts`, `note.service.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `ConnectionManager`, `UserService`, entities, `LogSync` (same pattern as ItemService)
- Produces: All CRUD endpoints for each entity

**Pattern:** Each module follows the same pattern as Task 7:
1. Service: `findAll`, `findOne`, `create`, `update`, `remove` — each create writes to both business table + LogSync
2. Controller: REST endpoints
3. Module: wires controller + service

**BusinessType mapping:**
- Book → `BusinessType.BOOK`
- Category → `BusinessType.CATEGORY`
- Fund → `BusinessType.FUND`
- Shop → `BusinessType.SHOP`
- Symbol (Tag/Project) → `BusinessType.SYMBOL`
- Note → `BusinessType.NOTE`

**Special notes:**
- **Books**: `parentType` = `'root'`, `parentId` = `'None'` (top-level entity)
- **Categories/Funds/Shops/Tags/Projects**: `parentType` = `'book'`, `parentId` = `accountBookId`
- **Notes**: `parentType` = `'book'`, `parentId` = `accountBookId`
- **Tags**: Use `AccountSymbol` entity with `symbolType = SymbolType.TAG`
- **Projects**: Use `AccountSymbol` entity with `symbolType = SymbolType.PROJECT`
- **Funds**: Read-only in this phase (GET only per design spec)
- **Categories**: Support tree structure via parent codes

- [ ] **Step 1: Create all business modules following the Item module pattern**
- [ ] **Step 2: Register all modules in AppModule**
- [ ] **Step 3: Build and verify**
- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: all business modules - books, categories, funds, shops, tags, projects, notes CRUD"
```

---

## Task 9: Attachment Module

**Files:**
- Create: `server/src/attachments/attachment.module.ts`
- Create: `server/src/attachments/attachment.controller.ts`
- Create: `server/src/attachments/attachment.service.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `ConnectionManager`, `UserService`, `AttachmentEntity` entity
- Produces: `POST /api/attachments/upload`, `GET /api/attachments/:id`, `DELETE /api/attachments/:id`

- [ ] **Step 1: Create AttachmentService**

Handles file storage in `data/{userId}/attachments/`, LogSync creation for each attachment.

```typescript
// Key methods:
async upload(userId: string, file: Express.Multer.File, businessCode: string, businessId: string)
async download(userId: string, attachmentId: string): Promise<{ stream: ReadStream; fileName: string }>
async remove(userId: string, attachmentId: string)
```

Files stored at: `{dataPath}/{userId}/attachments/{attachmentId}.{extension}`

- [ ] **Step 2: Create AttachmentController with multer**
- [ ] **Step 3: Create AttachmentModule, register in AppModule**
- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: attachment module - file upload/download/delete with sync"
```

---

## Task 10: Transform Interceptor + Serve Static

**Files:**
- Create: `server/src/interceptors/transform.interceptor.ts`
- Modify: `server/src/main.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: none
- Produces: All API responses wrapped as `{ code: 0, data: ..., message: 'ok' }`, Vue SPA served from `/`

- [ ] **Step 1: Create TransformInterceptor**

```typescript
// server/src/interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({ code: 0, data, message: 'ok' })),
    );
  }
}
```

- [ ] **Step 2: Register interceptor globally in app.module.ts**

```typescript
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
],
```

- [ ] **Step 3: Configure ServeStatic for Vue SPA in production**

```typescript
// Add to app.module.ts imports:
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

ServeStaticModule.forRoot({
  rootPath: path.join(__dirname, 'public'),
  exclude: ['/api/(.*)'],
}),
```

- [ ] **Step 4: Update main.ts to enable CORS and validation pipe**

Already done in Task 1 Step 5. Verify it's correct.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: response interceptor + static file serving for Vue SPA"
```

---

## Task 11: Vue Frontend — Auth, Layout, Core Pages

**Files:**
- Create/Modify: `web/src/api/http.ts`, `web/src/api/index.ts`
- Create: `web/src/stores/auth.ts`, `web/src/stores/app.ts`
- Create: `web/src/views/Login.vue`, `web/src/views/Layout.vue`
- Create: `web/src/views/ItemsView.vue`, `web/src/views/ItemForm.vue`
- Create: `web/src/views/Books.vue`, `web/src/views/Notes.vue`, `web/src/views/NoteForm.vue`
- Create: `web/src/views/settings/*.vue` (Categories, Shops, Tags, Projects, Funds)
- Create: `web/src/composables/useResponsive.ts`
- Modify: `web/src/router/index.ts`, `web/src/main.ts`
- Copy: `web/src/styles/tokens.css`, `web/src/styles/themes.ts` from admin-web

**Interfaces:**
- Consumes: All API endpoints from Tasks 5-9
- Produces: Complete responsive web UI

- [ ] **Step 1: Create api/http.ts (Axios instance)**

```typescript
import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('web_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body?.code === 0) return body.data;
    return body;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('web_token');
      router.push('/login');
    }
    const msg = err.response?.data?.message || err.message || '请求失败';
    ElMessage.error(msg);
    return Promise.reject(err);
  },
);

export default http;
```

- [ ] **Step 2: Create api/index.ts with all API functions**

```typescript
import http from './http';

export const authApi = {
  login: (data: { mainServerUrl: string; username: string; password: string }) =>
    http.post('/auth/login', data),
};

export const itemApi = {
  list: (params: any) => http.get('/items', { params }),
  get: (id: string) => http.get(`/items/${id}`),
  create: (data: any) => http.post('/items', data),
  update: (id: string, data: any) => http.put(`/items/${id}`, data),
  delete: (id: string) => http.delete(`/items/${id}`),
};

export const bookApi = {
  list: (params?: any) => http.get('/books', { params }),
  create: (data: any) => http.post('/books', data),
  update: (id: string, data: any) => http.put(`/books/${id}`, data),
  delete: (id: string) => http.delete(`/books/${id}`),
};

export const categoryApi = { /* same pattern */ };
export const fundApi = { list: (params?: any) => http.get('/funds', { params }) };
export const shopApi = { /* CRUD */ };
export const tagApi = { /* CRUD */ };
export const projectApi = { /* CRUD */ };
export const noteApi = { /* CRUD */ };
export const attachmentApi = { /* upload, download, delete */ };
export const syncApi = {
  push: () => http.post('/sync/push'),
  pull: (data?: any) => http.post('/sync/pull', data),
  status: () => http.get('/sync/status'),
};
```

- [ ] **Step 3: Create stores/auth.ts (Pinia)**

```typescript
import { defineStore } from 'pinia';
import { authApi } from '../api';
import router from '../router';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('web_token') || '',
    nickname: localStorage.getItem('web_nickname') || '',
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
  },
  actions: {
    async login(mainServerUrl: string, username: string, password: string) {
      const res = await authApi.login({ mainServerUrl, username, password });
      this.token = res.access_token;
      this.nickname = res.nickname;
      localStorage.setItem('web_token', res.access_token);
      localStorage.setItem('web_nickname', res.nickname);
      router.push('/');
    },
    logout() {
      this.token = '';
      this.nickname = '';
      localStorage.removeItem('web_token');
      localStorage.removeItem('web_nickname');
      router.push('/login');
    },
  },
});
```

- [ ] **Step 4: Create stores/app.ts**

```typescript
import { defineStore } from 'pinia';
import { bookApi } from '../api';

export const useAppStore = defineStore('app', {
  state: () => ({
    books: [] as any[],
    currentBookId: localStorage.getItem('currentBookId') || '',
  }),
  actions: {
    async loadBooks() {
      const res = await bookApi.list();
      this.books = Array.isArray(res) ? res : (res?.items || []);
      if (!this.currentBookId && this.books.length > 0) {
        this.currentBookId = this.books[0].id;
      }
    },
    switchBook(id: string) {
      this.currentBookId = id;
      localStorage.setItem('currentBookId', id);
    },
  },
});
```

- [ ] **Step 5: Create Login.vue**

```vue
<template>
  <div class="login-container glass">
    <h2>记账助手</h2>
    <el-form @submit.prevent="handleLogin">
      <el-form-item label="主端地址">
        <el-input v-model="form.mainServerUrl" placeholder="http://your-server:3000" />
      </el-form-item>
      <el-form-item label="用户名">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" />
      </el-form-item>
      <el-button type="primary" native-type="submit" :loading="loading">登录</el-button>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ mainServerUrl: '', username: '', password: '' });
async function handleLogin() {
  loading.value = true;
  try { await auth.login(form.mainServerUrl, form.username, form.password); }
  finally { loading.value = false; }
}
</script>
```

- [ ] **Step 6: Create Layout.vue with responsive sidebar/tabs**

Implement responsive layout:
- Desktop (≥768px): sidebar navigation
- Mobile (<768px): bottom tab bar

Include routes: Items, Books, Notes, Settings.

- [ ] **Step 7: Create ItemsView.vue (item list with month filter)**
- [ ] **Step 8: Create ItemForm.vue (create/edit form with all fields)**
- [ ] **Step 9: Create Books.vue, Notes.vue, NoteForm.vue**
- [ ] **Step 10: Create settings pages (Categories, Shops, Tags, Projects, Funds)**
- [ ] **Step 11: Copy theme files from admin-web**
- [ ] **Step 12: Wire router with all routes and auth guard**
- [ ] **Step 13: Build and verify full flow**

```bash
cd web && npm run build
cd ../server && npx nest build
node dist/main.js
# Open browser to http://localhost:3001
```

- [ ] **Step 14: Commit**

```bash
git add -A && git commit -m "feat: Vue 3 frontend - login, responsive layout, all pages"
```

---

## Task 12: Auto-Sync + Integration Testing

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/main.ts`

**Interfaces:**
- Consumes: `SyncService` (Task 6)
- Produces: Periodic auto-sync per user

- [ ] **Step 1: Add auto-sync scheduler**

Add a `setInterval`-based scheduler in `SyncService` that iterates all active users and runs push+pull periodically.

- [ ] **Step 2: End-to-end test**

1. Start the main server (clsswjz-server) on port 3000
2. Start clsswjz-agent on port 3001
3. Register a user on the main server
4. Login via clsswjz-agent → verify JWT returned
5. Create a book via clsswjz-agent → verify it appears in local SQLite
6. Push to main server → verify the book exists on the main server
7. Create an item on the main server (via admin or Flutter)
8. Pull on clsswjz-agent → verify the item appears locally
9. Verify MaterializeService ran and business tables are populated

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: auto-sync scheduler + integration verified"
```

---

## Task 13: Docker Build + Documentation

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Create: `README.md`

- [ ] **Step 1: Finalize Dockerfile**

Ensure multi-stage build: builder stage compiles server + web, production stage copies dist + node_modules.

- [ ] **Step 2: Test Docker build**

```bash
docker build -t clsswjz-agent .
docker run -p 3001:3001 -e JWT_SECRET=test-secret -v $(pwd)/data:/app/data clsswjz-agent
```

- [ ] **Step 3: Write README.md**

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "docs: README + Docker build verified"
```
