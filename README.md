# CLSSWJZ-Agent

CLSSWJZ-Agent 是个人财务管理系统 CLSSWJZ 的独立部署同步代理服务，作为与 iOS/Android 端平级的 Web 客户端节点。基于 NestJS + Vue 3 + SQLite 构建，每个用户拥有独立数据目录（独立 SQLite 数据库 + 附件文件），通过 sync push/pull 与主端（clsswjz-server）保持数据同步。本服务不存储用户密码，仅将登录凭证转发给主端验证。

## 架构简述

前端（Vue 3 SPA）由后端（NestJS）静态托管；用户登录时输入主端地址、用户名和密码，服务端转发凭证到主端换取 JWT 签发本服务自身的会话令牌。所有业务数据写入该用户专属的 SQLite 数据库，后台定时任务（以及手动触发）通过 sync push/pull 与主端双向同步。

```
+-------------+     HTTPS      +-----------------+     push/pull     +---------------+
|   Browser   | <------------> |  clsswjz-agent  | <---------------> | clsswjz-server |
| (Vue 3 SPA) |    /api/*      |  (NestJS+SQLite)|                   |    (主端)      |
+-------------+                +-----------------+                   +---------------+
                                        |
                                        v
                                 data/{userId}/db.sqlite + attachments/
```

## 功能列表

- 记账 CRUD：收支记录的创建、查询、修改、删除
- 账本管理：多账本的查看与创建
- 分类 / 商户 / 标签 / 项目管理：基础维度的查询与新增
- 账户（资金账户）查看
- 记事：文字记事的增查改删
- 附件：上传、列表、下载
- 自动同步：定时 push/pull 与主端保持一致，支持手动触发与同步状态查询

## 快速开始

### 开发模式

在项目根目录分别开两个终端运行：

```bash
# 终端 1：启动后端（端口 3001）
npm run dev:server

# 终端 2：启动前端 dev server（端口 5173，/api 代理到 3001）
npm run dev:web
```

### 生产构建

注意构建顺序：必须**先 `nest build` 再 `vite build`**。因为 nest-cli.json 配置了 `deleteOutDir: true`，nest build 会清空整个 `server/dist` 目录；而 vite 的输出目录是 `server/dist/public`，如果先构建 web 会被 nest build 一并删除。

```bash
cd server && npx nest build
cd ../web && npx vite build
# 产物：server/dist/main.js + server/dist/public/index.html
```

根目录也提供了完整脚本：

```bash
npm run build   # 内部已按正确顺序执行
npm run start   # node server/dist/main.js
```

### Docker 部署

```bash
docker compose up -d
```

或手动构建镜像：

```bash
docker build -t clsswjz-agent .
docker run -d -p 3001:3001 -v ./data:/app/data -e JWT_SECRET=your-secret clsswjz-agent
```

Dockerfile 中先执行 `nest build` 再执行 `vite build`，保证静态资源不被清空。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_PORT` | `3001` | 服务监听端口 |
| `DATA_PATH` | `./data` | 数据目录（meta 库、各用户数据库与附件） |
| `JWT_SECRET` | 无（必填） | JWT 签名密钥，生产环境务必修改 |
| `JWT_EXPIRES_IN` | `24h` | 会话令牌有效期 |
| `SYNC_INTERVAL` | `300000` | 自动同步间隔（毫秒），默认 5 分钟 |

## 使用说明

1. 浏览器访问 `http://<host>:3001`，首次登录需填写三项信息：
   - 主端地址（clsswjz-server 的 URL）
   - 用户名
   - 密码
2. 登录成功后即可使用记账、账本、记事等功能。
3. 数据存储结构：

```
data/
├── meta.db                  # 元数据库：记录已注册的用户连接信息
└── {userId}/
    ├── db.sqlite            # 该用户的业务数据库
    └── attachments/         # 该用户的附件文件
```

## 技术栈

- 后端：NestJS 10、TypeORM、sqlite3、Passport JWT、class-validator
- 前端：Vue 3、Vue Router、Pinia、Element Plus、Axios、Vite
