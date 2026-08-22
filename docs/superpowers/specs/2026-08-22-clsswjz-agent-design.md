# CLSSWJZ-Agent 设计文档

## Context

CLSSWJZ 是一个个人财务管理系统，目前已有的组件：
- **clsswjz-server** — 主服务端（NestJS + TypeORM + MySQL/SQLite），管理台前端，sync hub
- **clsswjz-gui** — Flutter 移动端（iOS/Android），离线优先，log-based sync

**问题：** 缺少一个可以在 NAS/Docker 上独立部署的 Web 端，让用户通过浏览器访问和记账。

**目标：** 创建 `clsswjz-agent`，一个独立部署的同步代理服务（NestJS + Vue 3 + SQLite）。它代表用户与主端交互：本地缓存数据 + 异步同步。每个用户拥有完全独立的数据目录（SQLite + 附件）。优先实现围绕记账的最小功能集。

---

## 1. 架构概览

### 1.1 系统定位

clsswjz-agent 是一个**同步代理节点**，角色等同于 iOS/Android 端：
- 代表用户与主端（clsswjz-server）交互
- 本地缓存用户数据（SQLite + 附件）
- 通过 sync push/pull 与主端保持同步
- 提供 Web UI 供用户在浏览器中记账
- **不存储用户密码**，认证完全委托给主端

### 1.2 整体架构

```
┌─────────────────────────────────────────────────────────┐
│  NAS / Docker 部署 (clsswjz-agent)                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  NestJS Server (:3001)                            │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  全局数据库 (data/meta.db)                    │  │  │
│  │  │  ├── users 表                                │  │  │
│  │  │  │   (id, nickname, mainServerUrl, mainToken)│  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  连接管理器 (ConnectionManager)               │  │  │
│  │  │  ├── getRepository(userId, Entity)           │  │  │
│  │  │  ├── 按需创建/缓存 TypeORM 连接               │  │  │
│  │  │  └── 空闲连接自动释放                         │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                   │  │
│  │  AuthModule                                       │  │
│  │  ├── users 表 (meta.db，不存密码)                  │  │
│  │  ├── 自签 JWT (浏览器端)                           │  │
│  │  └── 主端地址 + token (用户级, sync 用)            │  │
│  │                                                   │  │
│  │  SyncModule                                       │  │
│  │  ├── push/pull ←→ 用户对应的主端                    │  │
│  │  ├── 每用户独立同步                                │  │
│  │  └── MaterializeService                           │  │
│  │                                                   │  │
│  │  REST API (用户端 CRUD)                            │  │
│  │  └── 所有业务请求通过 ConnectionManager             │  │
│  │       路由到用户专属 SQLite                         │  │
│  │                                                   │  │
│  │  静态资源 (Vue SPA 构建产物)                        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  data/                                                  │
│  ├── meta.db                    ← 全局用户元数据         │
│  ├── {userId1}/                                        │
│  │   ├── db.sqlite               ← 用户1的业务数据      │
│  │   └── attachments/           ← 用户1的附件           │
│  └── {userId2}/                                        │
│      ├── db.sqlite               ← 用户2的业务数据      │
│      └── attachments/           ← 用户2的附件           │
└─────────────────────────┬───────────────────────────────┘
                          │ sync push/pull
                          ↓
┌─────────────────────────────────────────────────────────┐
│  主端 (clsswjz-server)                                  │
│  MySQL/SQLite + sync hub + 管理台                        │
│  不同用户可连不同主端                                     │
└─────────────────────────────────────────────────────────┘
```

### 1.3 连接管理器 (ConnectionManager)

核心组件，负责按 userId 动态管理 TypeORM 连接：

```typescript
// ConnectionManager 设计
class ConnectionManager {
  private connections: Map<string, DataSource> = new Map();
  
  // 获取用户的数据仓库
  async getRepository<T>(userId: string, entity: new () => T): Promise<Repository<T>> {
    const ds = await this.getConnection(userId);
    return ds.getRepository(entity);
  }
  
  // 获取/创建用户连接
  private async getConnection(userId: string): Promise<DataSource> {
    if (this.connections.has(userId)) {
      return this.connections.get(userId)!;
    }
    const ds = new DataSource({
      type: 'sqlite',
      database: `data/${userId}/db.sqlite`,
      entities: [...],
      synchronize: true,
    });
    await ds.initialize();
    this.connections.set(userId, ds);
    return ds;
  }
  
  // 初始化用户数据目录（首次登录时）
  async initUserDataDir(userId: string): Promise<void> {
    // 创建 data/{userId}/ 目录
    // 创建 data/{userId}/attachments/ 目录
  }
}
```

### 1.4 数据流

```
请求认证:
  JWT → 解出 userId → 查 users 表 → 得到 mainServerUrl + mainToken
  → 注入请求上下文

读取:
  浏览器 → REST API → ConnectionManager(userId) → 用户 SQLite → 返回数据

写入:
  浏览器 → REST API → ConnectionManager(userId)
    → 用户 SQLite 写入
    → 同时创建 LogSync 记录 (sync_state=UNSYNCED)
    → 异步 push 到用户对应的主端

同步 (每用户独立):
  定时/手动 → SyncService(userId)
    → 查 users 表得到 mainServerUrl + mainToken
    → 调 {mainServerUrl}/api/sync/push 或 pull
    → MaterializeService 物化到用户 SQLite
```

---

## 2. 认证与登录状态管理

### 2.1 核心原则

- **clsswjz-agent 不存储用户密码**，认证完全委托给主端
- JWT 隐式关联：JWT 解出 userId → 查 users 表 → 得到对应主端地址 + token
- 不同用户可连接不同主端

### 2.2 双 Token 架构

| Token | 签发方 | 用途 | 持有者 | 有效期 |
|-------|--------|------|--------|--------|
| 主端 token | clsswjz-server | sync push/pull | meta.db users.mainToken | 与主端一致 |
| Web JWT | clsswjz-agent | 浏览器 REST API 认证 | 浏览器 localStorage | 24h |

### 2.3 登录/注册流程

```
1. 用户输入: 主端 HOST + 主端用户名 + 主端密码
2. clsswjz-agent 调主端 POST {HOST}/api/auth/login 验证,携带客户端标识(与 Flutter 端对齐):
   - clientType: 'web'(固定;对应主端 clientType 字段,用于主端 token 表区分客户端)
   - clientId: 浏览器唯一 ID——首次访问用 crypto.randomUUID() 生成,存 localStorage 复用
     (浏览器无稳定设备 ID,不可用 UA 充当 clientId)
   - clientName: navigator.userAgent(UA 字符串)
3. (可选)注册: 复用主端 POST {HOST}/api/sync/register 创建账号,返回结构与 login 一致
4. 主端返回: { access_token, userId, username, nickname }
5. 本地保存/更新: users 表
   - id = userId (来自主端)
   - nickname = username (来自主端)
   - mainServerUrl = HOST (用户输入)
   - mainToken = access_token (主端下发)
6. 签发本地 JWT: payload = { userId }，用本地 JWT_SECRET 签名
7. 返回 JWT 给浏览器，前端存入 localStorage('web_token')
```

### 2.4 users 表（meta.db）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar | 主端返回的 userId（作为主键） |
| nickname | varchar | 主端返回的用户昵称 |
| mainServerUrl | varchar | 该用户关联的主端地址 |
| mainToken | text | 主端下发的 token（加密存储） |
| createdAt | integer | 创建时间 |
| updatedAt | integer | 更新时间 |

**注意：** 不存储密码。认证完全委托给主端。

### 2.5 请求认证

```
浏览器请求:
  Authorization: Bearer <web_jwt>

JwtAuthGuard:
  验证 JWT → 解出 userId
  → 查 users 表 → 得到 mainServerUrl + mainToken
  → 注入 request.user = { userId, mainServerUrl, mainToken }
  → 401 → 前端跳转 /login
```

### 2.6 主端 token 失效处理

- 主端 token 为长期有效的随机串,**无过期时间**,仅在用户登出/修改密码等场景被主端 revoke
- sync push/pull 返回 401 时,说明 mainToken 已失效
- 前端收到 sync 失败(401)通知时,提示用户重新输入主端密码
- 重新调主端 auth/login 获取新 mainToken,更新 users 表

---

## 3. 同步机制

### 3.1 同步协议

与 Flutter 端完全一致，复用主端的 sync API（实现细节以 `clsswjz-server/src/services/sync.service.ts` 与 `clsswjz-gui/lib/services/sync_service.dart` 为准）：

- **Push**: `POST {mainServerUrl}/api/sync/push` — 将本地 LogSync 记录推送到主端
  - 请求体: `{ logs: LogSync[], syncTimeStamp }`；主端按 `log.id` 幂等（已存在直接返回 success），校验 `operatorId` 与账本权限
- **Pull**: `POST {mainServerUrl}/api/sync/pull` — 拉取主端新增/变更的 LogSync 记录
  - 请求体: `{ syncTimeStamp, page, pageSize, businessTypes?, commitId? }`；**分页接口**，需循环拉取直至 total 拉完（gui 用 1000/页）
  - `commitId`：push 返回的提交标识，pull 时携带可排除刚 push 的日志，避免重复物化
  - `businessTypes`：按同步优先级（P0-P3）过滤，gui 分"前台 P0+P1 / 后台 P2+P3"两段同步
- **附件（两段式，与 gui 一致）**:
  - Push 前: 本地 attachment CREATE 日志对应的文件 → `POST {mainServerUrl}/api/attachments/upload` 直传主端（10MB 限制）
  - Pull 后: attachment CREATE 日志且本地无文件时 → `GET {mainServerUrl}/api/attachments/:id` 下载到本地附件目录
- **注册**: `POST {mainServerUrl}/api/sync/register`（可选，Public，创建账号并签发 token）

**物化规则（本地 SQLite）**：与主端 `LogRunner` 完全一致——按 `operatedAt ASC` 回放；CREATE 用 save、UPDATE 为部分字段 `update`（目标行不存在则 no-op）、DELETE 按 businessId；`sanitizeAgainstEntity` 剥离未建模字段。冲突语义 = 记录级 last-write-wins，勿自行发明合并策略。

### 3.2 本地写入流程

```
用户创建/修改/删除数据
  → 写入本地 SQLite（业务表）
  → 同时创建 LogSync 记录（sync_state=UNSYNCED）
  → 触发 push（异步）
  → push 成功后标记 sync_state=SYNCED
```

### 3.3 Pull 流程

```
触发时机:
  - 页面加载/切换
  - 定时轮询（如每 5 分钟，SYNC_INTERVAL）
  - 用户手动刷新（下拉/按钮）

流程:
  - push 先行: 先 push 本地变更,拿到 commitId 与主端 syncTimeStamp
  - pull 请求携带 syncTimeStamp(主端上次返回的游标,非本地时钟) + commitId
  - 按 page/pageSize 分页循环,直至拉完 total 条
  - 每条记录物化到本地 SQLite(按 operatedAt 升序)
  - 同步结束后以主端返回的最新 syncTimeStamp 更新本地游标
```

### 3.4 数据隔离

与主端一致：
- 只同步当前用户自己的日志
- 只同步用户创建的或作为成员的账本数据
- push 时验证 operatorId 匹配当前用户

---

## 4. 后端模块设计

### 4.1 项目结构

```
clsswjz-agent/
├── server/                    # NestJS 后端
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/            # 环境配置
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── decorators/
│   │   │   └── current-user.ts
│   │   ├── core/
│   │   │   ├── connection-manager.ts   # 多租户连接管理器
│   │   │   └── user-context.ts         # 请求级用户上下文
│   │   ├── meta/                        # 全局元数据模块
│   │   │   ├── meta.module.ts
│   │   │   ├── meta.entity.ts          # User 实体 (meta.db)
│   │   │   └── user.service.ts
│   │   ├── modules/
│   │   │   ├── auth.module.ts
│   │   │   ├── sync.module.ts
│   │   │   ├── book.module.ts
│   │   │   ├── item.module.ts
│   │   │   ├── category.module.ts
│   │   │   ├── fund.module.ts
│   │   │   ├── shop.module.ts
│   │   │   ├── tag.module.ts
│   │   │   ├── project.module.ts
│   │   │   ├── attachment.module.ts
│   │   │   └── note.module.ts
│   │   ├── entities/          # TypeORM 实体（复用主端定义，用于用户级 SQLite）
│   │   ├── services/
│   │   ├── controllers/
│   │   └── dto/
│   ├── package.json
│   └── tsconfig.json
├── web/                       # Vue 3 前端
│   ├── src/
│   │   ├── api/               # HTTP 客户端 + API 封装
│   │   ├── router/
│   │   ├── views/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── stores/            # 状态管理
│   │   └── styles/            # 视觉对齐 Flutter(M3 主题定制)
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile
├── docker-compose.yml
└── package.json               # monorepo root
```

### 4.2 实体定义

#### 全局数据库 (meta.db)

| 实体 | 表名 | 字段 |
|------|------|------|
| User | users | id, nickname, mainServerUrl, mainToken, createdAt, updatedAt |

#### 用户级数据库 (data/{userId}/db.sqlite)

**与主端实体全量对齐**（参考 `clsswjz-server/src/pojo/entities/`，除 token 表外全部实体都需要——agent 代理本地查询与物化，缺一不可）：

| 实体 | 表名 | 核心字段 |
|------|------|----------|
| User | users | id, username, nickname, avatar, email, phone（主端用户镜像，USER 日志物化所需；不含密码） |
| AccountBook | account_books | id, name, description, defaultFundId, currencySymbol, createdBy |
| AccountBookUser | rel_accountbook_user | id, userId, accountBookId, canViewBook, canEditBook, canDeleteBook, canViewItem, canEditItem, canDeleteItem |
| AccountItem | account_items | id, amount, type, categoryCode, accountDate, fundId, shopCode, description, accountBookId, createdBy |
| AccountCategory | account_categories | id, name, code, categoryType, accountBookId |
| AccountFund | account_funds | id, name, fundType, fundBalance, isDefault, accountBookId |
| AccountShop | account_shops | id, name, code, accountBookId |
| AccountSymbol (TAG) | account_symbols | id, name, code, symbolType='TAG', accountBookId |
| AccountSymbol (PROJECT) | account_symbols | id, name, code, symbolType='PROJECT', accountBookId |
| AccountNote | account_notes | id, title, content, noteType, accountBookId |
| Attachment | attachment | id, originName, fileLength, extension, contentType, businessCode, businessId |
| LogSync | log_sync | id, businessType, operateType, businessId, operateData, syncState, operatorId, operatedAt |

**说明：**
- 所有业务实体均继承主端 BaseEntity 结构（id 为 32 位随机串主键 + createdAt/updatedAt，业务实体另含 createdBy/updatedBy/accountBookId）
- `rel_accountbook_user` 是账本成员与权限表：pull 的数据隔离（可见账本集合）与 bookMember 日志物化都依赖它
- **命名区分**：meta.db 的 `users`（agent 登录元数据）与业务库的 `users`（主端用户镜像）同名不同库，TypeORM 不同 DataSource 物理隔离无冲突；建议 meta.db 表名用 `agent_users` 以免混淆

**Item 关联字段：**
- tags: AccountItem.tagCode → AccountSymbol (symbolType=TAG)
- project: AccountItem.projectCode → AccountSymbol (symbolType=PROJECT)
- attachments: Attachment.businessCode='item' AND businessId=item.id

### 4.3 API 端点

#### 认证

| Method | Path | 说明 |
|--------|------|------|
| POST | /api/auth/login | 登录（调主端验证 + 本地签 JWT） |

#### 账本

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/books | 当前用户的账本列表 |
| POST | /api/books | 创建账本 |
| PUT | /api/books/:id | 编辑账本 |
| DELETE | /api/books/:id | 删除账本 |

#### 记账记录

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/items | 记录列表（分页，按账本/类型/日期筛选） |
| GET | /api/items/:id | 记录详情 |
| POST | /api/items | 创建记录 |
| PUT | /api/items/:id | 编辑记录 |
| DELETE | /api/items/:id | 删除记录 |

#### 分类

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/categories | 分类列表（支持 tree 结构） |
| POST | /api/categories | 创建分类 |
| PUT | /api/categories/:id | 编辑分类 |
| DELETE | /api/categories/:id | 删除分类 |

#### 资金账户

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/funds | 账户列表 |

#### 商户

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/shops | 商户列表 |
| POST | /api/shops | 创建商户 |
| PUT | /api/shops/:id | 编辑商户 |
| DELETE | /api/shops/:id | 删除商户 |

#### 标签

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/tags | 标签列表 |
| POST | /api/tags | 创建标签 |
| PUT | /api/tags/:id | 编辑标签 |
| DELETE | /api/tags/:id | 删除标签 |

#### 项目

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/projects | 项目列表 |
| POST | /api/projects | 创建项目 |
| PUT | /api/projects/:id | 编辑项目 |
| DELETE | /api/projects/:id | 删除项目 |

#### 附件

| Method | Path | 说明 |
|--------|------|------|
| POST | /api/attachments/upload | 上传附件 |
| GET | /api/attachments/:id | 下载附件 |
| DELETE | /api/attachments/:id | 删除附件 |

#### 记事

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/notes | 记事列表 |
| GET | /api/notes/:id | 记事详情 |
| POST | /api/notes | 创建记事 |
| PUT | /api/notes/:id | 编辑记事 |
| DELETE | /api/notes/:id | 删除记事 |

#### 同步

| Method | Path | 说明 |
|--------|------|------|
| POST | /api/sync/push | 推送本地变更到主端 |
| POST | /api/sync/pull | 从主端拉取变更 |
| GET | /api/sync/status | 同步状态 |

---

## 5. 前端设计

### 5.1 技术栈

- **Vue 3** + Composition API
- **Element Plus** — UI 组件库（M3 化，可定制主题色/圆角/暗色，与 Flutter Material 3 对齐）
- **Vite** — 构建工具
- **Vue Router** — 路由
- **Pinia** — 状态管理
- **Axios** — HTTP 请求
- **视觉对齐 Flutter 端**（clsswjz-gui ThemeProvider）：Material 3 白卡片设计语言，主题色种子 + 明暗/字号/圆角可配置（不再使用管理台玻璃拟态风格）

### 5.2 响应式布局

**移动优先（移动端是主形态，桌面端是增强形态）**。布局与交互**向 Flutter 移动端靠齐**；视觉采用与 Flutter 一致的 **Material 3 白卡片语言**；桌面浏览器做响应式增强适配（多列网格、侧栏导航、悬停态、键盘快捷键）：

```
移动端 (<768px) — 主形态, 与 Flutter 端对齐:
┌──────────────────────────────────────────┐
│  顶部栏 (账本选择器 + 同步状态)            │  ← BookSelector, 对齐 Flutter items_tab
├──────────────────────────────────────────┤
│                                          │
│  内容区 (本月统计卡 → 记录列表)            │
│                                          │
├──────────────────────────────────────────┤
│  底部 Tab (记账 | 统计 | 工具 | 我的)      │  ← 与 Flutter 底部 Tab 一致
└──────────────────────────────────────────┘
        FAB (+) 悬浮右下

桌面端 (≥768px):
┌──────────────────────────────────────────┐
│  顶栏 (账本选择器 + 同步状态 + 用户菜单)   │
├────────┬─────────────────────────────────┤
│ 侧栏   │  内容区 (居中, 最大宽度 1200px)   │
│ 记账   │   ┌────────┬────────┬────────┐  │
│ 统计   │   │ 统计卡 │ 统计卡 │ 统计卡 │  │  ← 卡片多列网格
│ 工具   │   └────────┴────────┴────────┘  │
│ 我的   │   ┌──────────────────────────┐  │
│        │   │ 记录列表 (行操作悬停可见)  │  │
│        │   └──────────────────────────┘  │
└────────┴─────────────────────────────────┘
        侧栏 = 移动端 Tab 的横向映射, 结构一致
```

### 5.3 路由结构

移动端底部 Tab 与 Flutter 端一致：**记账 | 统计 | 工具 | 我的**（Phase 1 只实现记账 Tab，其余为占位入口）；路由表：

| 路由 | 页面 | 说明 |
|------|------|------|
| /login | Login | 登录（输入主端 HOST + 用户名 + 密码） |
| / | ItemsView | 记账首页：顶栏账本选择器 + 本月统计卡 + 最近记录 + FAB |
| /item/new | ItemForm | 新建记账记录（自动聚焦金额 → 弹出计算器面板） |
| /item/:id | ItemDetail | 记录详情/编辑 |
| /books | Books | 账本列表（新建/切换默认账本） |
| /notes | Notes | 记事列表 |
| /note/new | NoteForm | 新建记事 |
| /note/:id | NoteForm | 编辑记事 |
| /settings/categories | Categories | 分类管理（树形） |
| /settings/shops | Shops | 商户管理 |
| /settings/tags | Tags | 标签管理 |
| /settings/projects | Projects | 项目管理 |
| /settings/funds | Funds | 账户查看（只读） |
| /settings/sync | SyncStatus | 同步状态页（Phase 1 需补） |

### 5.4 记账表单核心交互

**对齐 Flutter `modern_item_form.dart`**——金额通过计算器面板弹层输入（非普通文本框）：

```
┌─────────────────────────────────┐
│  [支出] [收入]  ← 类型切换(动画)  │
│                                 │
│  ¥ 0.00          ← 点击弹出      │
│                   计算器面板      │
│                                 │
│  分类    [餐饮]  ← 树形选择      │
│  账户    [微信]  ← 列表选择      │
│  商户    [美团]  ← 搜索选择      │
│  标签    [+标签] ← 多选 badge   │
│  项目    [旅行]  ← 单选          │
│  日期    [今天]  ← 日期+时间选择  │
│                                 │
│  备注      ← 文本输入            │
│  附件      ← 上传文件/图片       │
│                                 │
│  [保存]                         │
└─────────────────────────────────┘

计算器面板 (对齐 Flutter CalculatorPanel):
  底部弹出, 数字键盘 + 运算(+ - × ÷) + 退格 + 清零
  输入完成 → 金额回填表单, 面板收起
  新增页自动弹出(autoFocusAmount)
```

### 5.5 设计风格

**视觉向 Flutter 移动端靠齐：Material 3 白卡片设计语言**（对齐 clsswjz-gui ThemeProvider，参考 `theme_provider.dart`），同时兼顾 PC 浏览器使用：

**视觉体系（与 Flutter 端一致）**

| 项 | 取值 | 说明 |
|----|------|------|
| 设计语言 | Material 3 | 白底 + 主题色种子，非管理台玻璃拟态 |
| 表面 | 纯白（亮色）卡片；暗色用 M3 surface | 对齐 Flutter scaffoldBackgroundColor: white |
| 主题色 | 用户可配置（对齐 Flutter Colors.primaries / themeColor） | Element Plus 动态 primary |
| 明暗模式 | 亮/暗/跟随系统 | 对齐 Flutter ThemeMode |
| 圆角 | 可配置：0 / 4 / 8 / 12 px | 对齐 Flutter RadiusSize |
| 字号 | 可配置：0.85 / 1.0 / 1.15 / 1.3 | 对齐 Flutter FontSize |
| 间距 | 表单 16/24，列表 12/16（对齐 ThemeSpacing） | — |
| 语义色 | 收入绿 #10b981 / 支出红 #ef4444（中国记账惯例） | 与 Flutter 端一致 |

**桌面端（PC 浏览器）适配原则**
- 内容区居中，最大宽度 1200px，避免超宽屏行过长
- 统计卡/记录列表在桌面用多列网格（重复利用移动端单列卡片组件）
- 悬停态增强：记录行操作按钮（编辑/删除）hover 时显示；桌面不依赖长按
- 桌面侧栏导航替代移动端底部 Tab（结构一致，见 5.2）
- 表单字段在桌面可双列布局（金额+日期 同排），其余交互与移动端一致
- 支持键盘操作：Tab 导航、Enter 保存、Esc 关闭弹层、/ 或 Ctrl+K 聚焦记账

**与管理台的关系**：仅借鉴其明暗切换实现思路；视觉语言不再复用管理台玻璃拟态与金色主题。

### 5.6 核心用户流程

```
【首次登录】
  /login → 输入 主端地址+用户名+密码 → 连接校验(loading)
    ├─ 成功 → 首次同步引导页(进度条) → 进入首页
    └─ 失败 → 错误提示(区分: 连接失败 / 账号密码错误 / 主端不可达)

【日常记账】(核心任务, 目标单笔 <10s)
  首页 → FAB(+) → 记账表单(自动弹出计算器; 默认: 支出 / 今天 / 上次使用的分类+账户)
    → 保存 → 立即关闭返回首页, Toast「已保存，待同步」
    → 新记录插入列表顶部(乐观 UI)

【同步】
  自动: 定时轮询(SYNC_INTERVAL=5min) + 页面加载时
  手动: 首页下拉刷新 / 顶栏同步按钮
  反馈: 同步中 → 顶部细进度条 + 角标旋转
        成功   → 静默, 更新"上次同步时间"
        失败   → 非阻塞 Toast + 重试入口
        离线   → 常驻「未同步 N 条」角标(仅移动端)

【数据管理】
  设置 → 分类(树形) / 商户 / 标签 / 项目 → 增删改
  账本页 → 切换默认账本 / 新建账本
  记事页 → 纯文本记事 CRUD
```

### 5.7 组件规范

| 组件 | 规范 |
|------|------|
| **主按钮 / FAB** | 主题色实底（M3 primary），白字；FAB 56px 悬浮右下，桌面端 48px；禁用态 opacity .5 |
| **次按钮** | 白底 + 1px 中性边框 + 次级文字（M3 outlined） |
| **危险操作** | 红色（#ef4444），删除确认用二次确认弹层（文案含删除对象名称） |
| **类型分段控件** | 支出/收入两段滑块指示器（对齐 Flutter AnimatedTypeToggle）；选中态：支出红 / 收入绿；切换带动画 |
| **金额输入** | 只读展示（大字号 28-32px + 等宽数字 + ¥），**点击弹出计算器面板**（对齐 Flutter CalculatorPanel：数字键盘 + 四则运算 + 退格/清零），桌面端同样用计算器保持一致交互 |
| **卡片** | 纯白底（亮色）+ 主题圆角（可配 0/4/8/12）+ 极浅描边/轻阴影（对齐 M3 Card）；hover 轻微上浮 |
| **记录列表项** | 左侧分类图标（主题色浅底圆 40px），中间名称+备注，右侧金额（支出红 / 收入绿）；按天分组，组头显示日期+星期+当日小计 |
| **树形选择器** | 分类树（默认展开一级），选中高亮主题色，支持搜索过滤 |
| **搜索选择器** | 商户/标签：输入即搜 + 常用项置顶；无结果时「创建"xx"」快捷入口 |
| **标签 badge** | 多选胶囊，选中主题色浅底 + 主题色文字，可点 x 移除 |
| **日期选择器** | 默认今天；快捷项：今天/昨天/本周/上月；自定义日历 |
| **附件区** | 缩略图网格（图片预览），上传中显示进度遮罩，可单删；限制 10MB/个 |
| **状态页** | 统一封装 StatePage：加载骨架 / 空态插图+文案+行动按钮 / 错误+重试 |
| **同步角标** | 顶栏图标：静止=已同步，旋转=同步中，感叹号=有失败，数字=待同步 N 条（桌面不显示数字，hover 提示） |

### 5.8 页面状态设计

所有列表/详情页统一四态（由 StatePage 封装，禁止裸手写）：

1. **加载中** — 骨架屏（卡片占位 + 渐变呼吸动画），首屏 <300ms 内显示，避免闪烁
2. **有数据** — 正常渲染
3. **空状态** — 居中插图 + 一句引导文案 + 主行动按钮（如"记一笔"），不显示空白页
4. **错误状态** — 错误文案 + 「重试」按钮；网络类错误额外提示检查主端连接

叠加状态（与四态正交）：
- **离线/未同步** — 顶栏常驻角标（移动端显示数字，桌面 hover 提示），点击进入同步状态页
- **同步中** — 全局顶部细进度条（2px，主题色），不阻塞操作

### 5.9 关键页面交互细节

**首页 ItemsView（对齐 Flutter items_tab 结构）**
- 顶栏 = **账本选择器**（切换账本即时刷新统计与列表，对齐 BookSelector），右侧同步状态角标
- 本月统计卡：本月收入（绿）/支出（红）/结余；可配置显示每日统计条/日历（对齐 Flutter itemTabComponentOrder 配置）
- 记录列表：按天分组 + 组头当日小计；移动端下拉刷新 = 手动同步，点击记录进入编辑；**桌面端记录行 hover 显示编辑/删除操作按钮，右键弹出更多菜单**
- FAB：悬浮右下；快速记账默认值 = 上次记账的分类/账户（本地记忆）；桌面端另有快捷键（/ 或 Ctrl+K）触发记账

**记账表单 ItemForm（对齐 Flutter modern_item_form）**
- **金额 = 计算器面板**：新增页自动弹出并聚焦（autoFocusAmount）；输入完成回填收起；支持四则运算
- 字段记忆：分类/账户/标签沿用上次，减少重复操作（核心可用性设计）
- 类型切换：AnimatedTypeToggle 滑块动画；切换时清空分类（支出/收入分类树不同），金额保留
- 日期+时间：日期与时间分段选择（对齐 Flutter accountDate 含时间）
- 错落入场：字段区按序淡入（对齐 Flutter _sectionVisible）
- 编辑页 autoSave：字段变更即保存（本地），退出自动提交；新增页显式保存按钮
- 保存：防重复提交；成功后乐观关闭（先写本地 SQLite，同步异步）
- 附件：选择后立即上传（显示进度），随记录一起保存关联
- **桌面端**：表单双列布局（金额+日期同排），Enter 保存、Esc 收起计算器/关闭

**设置页**
- 分类管理：树形展示，长按（移动）/右键（桌面）操作（编辑/删除/新建子类）；删除有子类时先提示转移
- 商户/标签/项目：分组列表 + 底部新增；支持重命名/删除
- 账户：只读列表（资金余额展示，编辑回主端/Flutter 端）
- 同步状态页：上次同步时间、待同步条数、最后失败原因、手动同步按钮、主端地址展示

**登录页 Login**
- 居中白卡片（M3）：品牌 Logo + 主端地址 + 用户名 + 密码
- 主端地址自动补全 https://、记住上次地址（localStorage）
- 连接校验 loading 态；错误区分：DNS/连接失败、401 账号密码错误、非 CLSSWJZ 服务
- 移动端：自动填充、密码可见切换；桌面端：Enter 提交、焦点自动落到主端地址框

### 5.10 微交互与动效

| 场景 | 动效 | 时长 |
|------|------|------|
| 类型切换 | 分段滑块平移（AnimatedTypeToggle） | 200ms ease |
| 表单入场 | 字段区错落入场（对齐 Flutter） | 200ms 阶梯 |
| 计算器 | 底部弹出/收起（slide-up） | 250ms ease-out |
| 列表进入/删除 | 淡入 + 轻微上移；删除项高度折叠 | 200ms |
| FAB | hover 上浮 2px + 阴影加深 | 150ms |
| 同步成功 | 顶栏图标打勾回弹 | 300ms |
| 页面切换 | 移动端左右滑动过渡，桌面淡入 | 250ms |
| 数字变化 | 金额仅做瞬时更新，不做滚动动画（记账场景求快） | — |

约束：所有动画仅在 `prefers-reduced-motion: no-preference` 下启用；动画只作用于 transform/opacity，避免触发重排。

### 5.11 无障碍与可用性

- **对比度**：正文 ≥4.5:1（WCAG AA）；主按钮用主题色实底 + 白字（M3 primary/onPrimary 组合保证对比）
- **触控目标**：移动端所有可点元素 ≥44px（Tab、FAB、列表操作、badge 的 x）
- **键盘导航**：表单 Tab 顺序与视觉一致；Esc 关闭弹层；焦点环使用主色 outline
- **语义化**：计算器按钮带 aria-label（数字/运算符）；金额展示用 role="text"；日期用原生选择器兜底；列表用 role="list"
- **键盘兜底**：桌面端金额提供原生输入兜底（无计算器时 inputmode="decimal"），键盘 Tab 顺序与视觉一致
- **文本缩放**：200% 缩放不破版（弹性布局 + 不固定死宽度）
- **动效**：尊重 prefers-reduced-motion（见 5.10）
- **离线可用**：核心记账流程在无网时完全可用，仅同步受限（这是本产品相较管理台的核心价值，需在交互上明示"已保存本地"）

---

## 6. 部署

### 6.1 Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY server/ server/
COPY web/ web/
RUN cd server && npm install && npm run build
RUN cd web && npm install && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/web/dist ./web-dist
COPY server/package*.json ./
RUN npm install --production
EXPOSE 3001
CMD ["node", "dist/main"]
```

### 6.2 Docker Compose

```yaml
services:
  agent:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - SERVER_PORT=3001
      - JWT_SECRET=随机密钥
      - JWT_EXPIRES_IN=24h
    volumes:
      - ./data:/data
    restart: unless-stopped
```

### 6.3 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| SERVER_PORT | 服务端口 | 3001 |
| JWT_SECRET | JWT 签名密钥 | （必填） |
| JWT_EXPIRES_IN | JWT 有效期 | 24h |
| SYNC_INTERVAL | 自动同步间隔（ms） | 300000（5分钟） |

**注意：** 主端地址不再由环境变量配置，而是每个用户在登录时输入，存储在 meta.db users 表中。

---

## 7. 实施范围

### Phase 1: 记账核心（优先）
- 项目脚手架搭建（monorepo: server + web）
- 认证模块（登录/JWT，调主端验证）
- 多租户连接管理器（ConnectionManager）
- 同步模块（push/pull + MaterializeService）
- 记账记录 CRUD + 前端页面
- 账本切换
- 分类、账户、商户的基础数据
- 标签、项目管理
- 附件上传/下载
- 记事功能
- 响应式布局 + 主题系统

### Phase 2: 未来扩展
- 统计图表（趋势、分类饼图）
- 记账规则
- 周期性账目
- 数据导入
- 多语言
