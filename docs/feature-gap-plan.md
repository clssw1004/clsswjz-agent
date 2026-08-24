# 补齐 clsswjz-agent 缺失功能实施计划

## Context

clsswjz-agent 是 clsswjz-server 的 Web 客户端，与 Flutter 移动端 (clsswjz-gui) 对等。当前 agent 已实现核心记账流程（条目 CRUD、账本、分类/商户/标签/项目、笔记、附件、同步），但缺失多个业务模块的 REST API 和前端页面。

**目标**: 逐项补齐所有缺失功能，每项完成后可独立验证。

> 最后更新: 基于 clsswjz-gui main 分支 (含 v1.2.2 + 经期管理模块)

---

## 差异总览

### 后端 (NestJS) — 缺失 11 个模块的 REST API

| # | 模块 | Entity 文件 | 同步支持 | REST API | 前端页面 |
|---|------|------------|---------|----------|---------|
| 1 | 债务管理 | `account-debt.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 2 | 礼品卡 | `gift-card.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 3 | 打卡活动 | `activity-definition.entity.ts` + `activity-record.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 4 | 车辆管理 | `vehicle.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 5 | 加油记录 | `fuel-record.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 6 | 周期记账 (固定收支) | `recurring-config.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 7 | 记账规则 | `bookkeeping-rule.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 8 | 用户分享 | `user-share.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 9 | 条目关联 | `item-relation.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 10 | 经期周期 | `period-cycle.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |
| 11 | 经期日记录 | `period-daily-record.entity.ts` ✅ | LogRunner ✅ | ❌ | ❌ |

> 所有 Entity 已在 `USER_ENTITIES` 中注册，TypeORM `synchronize: true` 自动建表，LogRunner 已支持 replay。**无需修改同步层**，只需新增 Controller + Service。

### 前端 (Vue 3) — 缺失 12 个页面模块 + 2 个增强

| # | 功能 | 对应后端 Phase | 前端 Phase |
|---|------|-------------|-----------|
| 1 | 债务管理 (list/add/edit/payment) | P1 | P1 |
| 2 | 礼品卡 (received/sent tabs, 生命周期) | P2 | P2 |
| 3 | 打卡活动 (定义/打卡/统计/日历) | P2 | P2 |
| 4 | 车辆加油 (车辆/加油记录/统计) | P3 | P3 |
| 5 | 固定收支 (recurring config list/form/detail) | P3 | P3 |
| 6 | 记账规则 (list/form/条件编辑器) | P3 | P3 |
| 7 | 经期记录 (日历/预测/打卡/统计) | P4 | P4 |
| 8 | 月报自动生成 + 叙述分析 | P5 | P5 |
| 9 | 数据导入 | P5 | P5 |
| 10 | 用户分享设置 | P5 | P5 |
| 11 | 条目关联面板 | P5 | P5 |
| 12 | 统计图表增强 (饼图/柱状图/热力图) | — | P6 |
| 13 | 功能中心 (Tools Tab) 重新设计 | — | P6 |

---

## Phase 1: 债务管理

> 最高优先级 — 个人记账核心补充

### 后端: `src/debts/`

**参考**: `lib/pages/book/debt_list_page.dart`, `AccountDebtTable`, `AccountDebtEntity`

**Entity 字段** (已存在 `src/entities/account-debt.entity.ts`):
- accountBookId, type (borrow-in/borrow-out), amount, counterparty, description, status (pending/settled), paidAmount, dueDate

**需新建文件**:
- `src/debts/debt.module.ts`
- `src/debts/debt.controller.ts`
- `src/debts/debt.service.ts`

**API 设计**:
```
GET    /api/debts                  — 列表 (query: accountBookId, type, status)
GET    /api/debts/:id              — 详情 (含还款记录)
POST   /api/debts                  — 创建
PUT    /api/debts/:id              — 更新
DELETE /api/debts/:id              — 删除
```

**修改**: `src/app.module.ts` — 注册 DebtModule

### 前端: `web/src/views/debts/`

**需新建文件**:
- `web/src/views/debts/DebtList.vue` — 借入/借出 tab, 进度条, 已还/待还金额
- `web/src/views/debts/DebtForm.vue` — 创建/编辑表单

**修改文件**:
- `web/src/api/index.ts` — 新增 `debtApi`
- `web/src/router/index.ts` — 新增路由
- `web/src/views/Features.vue` — 添加入口 (后续 P6 迁移到 Tools Tab)

---

## Phase 2: 礼品卡 + 打卡活动

### 2A: 礼品卡

**参考**: `lib/pages/gift_card/`, `GiftCardTable`, 生命周期 draft→sent→received→used/expired/voided

**后端: `src/gift-cards/`**
```
GET    /api/gift-cards              — 列表 (query: role=received|sent, status)
GET    /api/gift-cards/:id          — 详情
POST   /api/gift-cards              — 创建/发送
PUT    /api/gift-cards/:id/receive  — 接收确认
PUT    /api/gift-cards/:id/use      — 使用
PUT    /api/gift-cards/:id/void     — 作废
DELETE /api/gift-cards/:id          — 删除
```

**前端: `web/src/views/gift-cards/`**
- `GiftCardList.vue` — 双 tab (收到的/送出的), 卡片渐变色
- `GiftCardForm.vue` — 创建礼品卡

### 2B: 打卡活动

**参考**: `lib/pages/activity/`, `ActivityDefinitionTable` + `ActivityRecordTable`

**后端: `src/activities/`**
```
GET    /api/activities                — 活动定义列表
GET    /api/activities/:id            — 详情 + 统计 (今日/本周/累计)
POST   /api/activities                — 创建活动定义
PUT    /api/activities/:id            — 更新
DELETE /api/activities/:id            — 删除
POST   /api/activities/:id/checkin    — 打卡
DELETE /api/activities/records/:rid   — 取消打卡
GET    /api/activities/:id/records    — 打卡记录 (query: month)
```

**前端: `web/src/views/activities/`**
- `ActivityList.vue` — 活动卡片网格, 统计数据
- `ActivityForm.vue` — 创建/编辑活动
- `ActivityCheckin.vue` — 打卡视图

---

## Phase 3: 车辆加油 + 固定收支 + 记账规则

### 3A: 车辆加油

**参考**: `lib/pages/fuel/`, `VehicleTable` + `FuelRecordTable`, 自动计算 (任填2算第3)

**后端: `src/vehicles/` + `src/fuel-records/`**
```
# 车辆
GET    /api/vehicles                  — 列表
POST   /api/vehicles                  — 创建
PUT    /api/vehicles/:id              — 更新
DELETE /api/vehicles/:id              — 删除

# 加油记录
GET    /api/vehicles/:vid/fuel-records       — 列表
POST   /api/vehicles/:vid/fuel-records       — 创建
PUT    /api/vehicles/:vid/fuel-records/:fid  — 更新
DELETE /api/vehicles/:vid/fuel-records/:fid  — 删除
GET    /api/vehicles/:vid/fuel-records/stats — 统计
```

**前端: `web/src/views/vehicles/`**
- `VehicleList.vue`, `FuelRecordList.vue`, `FuelRecordForm.vue`

### 3B: 固定收支 (Recurring Config)

**参考**: `lib/pages/recurring_config/`, `RecurringConfigTable`, 月/周频率, 结束条件

**后端: `src/recurring-configs/`**
```
GET    /api/recurring-configs              — 列表
GET    /api/recurring-configs/:id          — 详情
POST   /api/recurring-configs              — 创建
PUT    /api/recurring-configs/:id          — 更新
DELETE /api/recurring-configs/:id          — 删除
POST   /api/recurring-configs/generate     — 手动生成到期记录
```

**前端: `web/src/views/recurring/`**
- `RecurringConfigList.vue`, `RecurringConfigForm.vue`

### 3C: 记账规则

**参考**: `lib/pages/bookkeeping_rule/`, `BookkeepingRuleTable`, 条件-动作规则引擎

**后端: `src/bookkeeping-rules/`**
```
GET    /api/bookkeeping-rules              — 列表
GET    /api/bookkeeping-rules/:id          — 详情
POST   /api/bookkeeping-rules              — 创建
PUT    /api/bookkeeping-rules/:id          — 更新
DELETE /api/bookkeeping-rules/:id          — 删除
POST   /api/bookkeeping-rules/evaluate     — 评估 (给定字段, 返回匹配规则)
```

**前端: `web/src/views/rules/`**
- `RuleList.vue`, `RuleForm.vue` (条件编辑器 + 动作编辑器)

---

## Phase 4: 经期记录

> 新增模块 — GUI 最新 main 分支引入，含预测算法

### 后端: `src/periods/`

**参考**: `lib/pages/period/`, `PeriodCycleTable` + `PeriodDailyRecordTable`, `PeriodPredictionService`, `PeriodCalcUtil`

**Entity 字段** (已存在):
- `PeriodCycle`: startDate, endDate, typicalPeriodDays, typicalCycleDays
- `PeriodDailyRecord`: cycleId, recordDate, flowLevel, symptoms (JSON), mood, remark

**新增枚举** (对齐 GUI):
- `FlowLevel`: none, light, medium, heavy
- `PeriodMood`: good, normal, bad, terrible

**需新建文件**:
- `src/periods/period.module.ts`
- `src/periods/period.controller.ts`
- `src/periods/period.service.ts`
- `src/enums/flow-level.enum.ts`
- `src/enums/period-mood.enum.ts`

**API 设计**:
```
# 周期管理
GET    /api/periods/cycles              — 月份列表 (query: month)
GET    /api/periods/cycles/recent       — 近 60 天周期 (用于统计)
GET    /api/periods/cycles/active       — 当前进行中的周期
POST   /api/periods/cycles              — 开始新周期 (startDate)
PUT    /api/periods/cycles/:id/end     — 结束周期 (endDate)
DELETE /api/periods/cycles/:id          — 删除周期

# 日记录
GET    /api/periods/cycles/:cid/records           — 某周期的日记录
PUT    /api/periods/cycles/:cid/records/:date     — 更新/创建日记录 (upsert)
DELETE /api/periods/cycles/:cid/records/:date     — 删除日记录

# 统计 + 预测
GET    /api/periods/statistics           — 计算统计 (平均周期长度, 平均经期长度, 预测下次日期, 排卵日)
GET    /api/periods/calendar/:year/:month — 日历日期类型映射 (period/ovulation/fertile/safe/predicted)
```

**修改**: `src/app.module.ts` — 注册 PeriodModule

### 前端: `web/src/views/periods/`

**需新建文件**:
- `web/src/views/periods/PeriodCalendar.vue` — 日历视图 (日期颜色标注: 经期/排卵/安全/预测)
- `web/src/views/periods/PeriodStatus.vue` — 状态卡片 (当前阶段, 距下次天数, 经期第几天)
- `web/src/views/periods/PeriodDailyForm.vue` — 日记录表单 (流量/症状/心情/备注)
- `web/src/views/periods/PeriodOnboarding.vue` — 首次使用引导 (设置典型周期/经期天数)
- `web/src/views/periods/PeriodPrediction.vue` — 预测卡片 (下次日期, 排卵窗口)

**新增枚举文件**:
- `web/src/api/index.ts` — 新增 `periodApi`

**修改文件**:
- `web/src/router/index.ts` — 新增 `/periods/calendar` 等路由

---

## Phase 5: 月报 + 导入 + 分享 + 关联

### 5A: 月报自动生成 + 叙述分析

**参考**: `lib/services/monthly_report_service.dart` + `lib/services/report_narrative_service.dart` (新增叙述分析)

**后端: `src/reports/`**

用现有 Note entity (NoteType=report)，新增月报生成逻辑:
```
POST /api/reports/generate           — 生成月报 (body: { year, month, accountBookId })
GET  /api/reports/:year/:month       — 获取月报
GET  /api/reports/missing            — 缺失月份列表
```

需实现: `ReportService` — 对齐 GUI `MonthlyReportService` 的完整报告数据 (汇总, 分类排行, 大额交易, 异常预警, 日均, 储蓄率, 趋势, 同比) + 叙述分析文本生成 (对齐 `ReportNarrativeService`)

**前端: `web/src/views/reports/`**
- `ReportList.vue` — 月报列表, 搜索, 缺失月份待生成卡片
- `ReportDetail.vue` — 完整月报渲染 (叙述摘要, 分类排行, 趋势图, 预警, 建议)

### 5B: 数据导入

**参考**: `lib/import/bohe/`

**后端: `src/import/`**
```
POST /api/import/preview  — 上传文件预览
POST /api/import/execute  — 确认导入
```

**前端: `web/src/views/import/ImportPage.vue`**

### 5C: 用户分享

**后端: `src/user-shares/`**
```
GET    /api/user-shares      — 列表
POST   /api/user-shares      — 创建
DELETE /api/user-shares/:id  — 取消
```

**前端: `web/src/views/shares/ShareSettings.vue`**

### 5D: 条目关联面板

**后端: `src/item-relations/`**
```
GET    /api/items/:id/relations          — 关联列表
POST   /api/items/:id/relations          — 创建关联
DELETE /api/items/:id/relations/:relId   — 删除关联
```

**前端**: `web/src/components/ItemRelationPanel.vue` (嵌入 ItemForm)

---

## Phase 6: 统计增强 + Tools Tab 重构

### 6A: 统计图表增强

**修改**: `web/src/views/Statistics.vue`

参考 GUI `StatisticsTab` + 组件:
- 分类饼图 (`category_pie_chart.dart`)
- 日均柱状图 (`daily_statistic_bar.dart`)
- 日历热力图 (`daily_statistic_calendar.dart`)
- 用户月度对比 (`user_monthly_statistic_chart.dart`)
- 项目月度统计 (`project_monthly_statistic_chart.dart`)

**需引入**: 图表库 (推荐 `vue-echarts` + echarts, 或 `chart.js` + vue-chartjs)

### 6B: Tools Tab (功能中心) 重构

参考 GUI 新的 `FeatureHubRegistry` 三组分类布局:

**重新设计**: `web/src/views/Features.vue` → 三组网格

**Group 1 — 账本数据**:
账目(高亮), 分类, 商家, 账户, 标签, 项目, 债务, 固定收支, 记账规则

**Group 2 — 生活扩展**:
记事, 经期记录, 活动打卡, 礼物卡, 加油记录

**Group 3 — 数据工具**:
账本, 导入, 附件, 报表, 同步设置

---

## 通用开发模式

### 后端 (每个模块遵循, 参考 `ItemService`)
1. `src/<module>/` 下创建 Module / Controller / Service
2. Controller: `@UseGuards(JwtAuthGuard)` + `req.user.userId` 做用户隔离
3. Service: `ConnectionManager.getRepository(userId, Entity)` 获取仓库
4. 每个 create/update/delete 写入 `LogSync` 记录 (确保同步)
5. 在 `src/app.module.ts` 注册

### 前端 (每个模块遵循, 参考 `Books.vue`)
1. `web/src/views/<module>/` 下创建 Vue 组件
2. API 方法添加到 `web/src/api/index.ts`
3. 路由添加到 `web/src/router/index.ts`
4. 复用 `Panel.vue` 作为容器组件
5. 移动端: `useResponsive()` + 底部 Sheet 模式

---

## 实施顺序与依赖

```
P1 (债务管理)              ← 独立, 可立即开始
P2 (礼品卡 + 打卡)         ← 独立, 可与 P1 并行
P3 (车辆加油 + 固定收支 + 规则) ← 独立, 可与 P1/P2 并行
P4 (经期记录)              ← 独立, 可与 P1-P3 并行
P5 (月报 + 导入 + 分享 + 关联) ← 月报依赖 P1-P4 的数据
P6 (统计图表 + Tools Tab)  ← 依赖 P1-P5 完成后有足够数据展示
```

---

## 验证方案

每个 Phase 完成后:
1. **后端**: curl 测试所有 CRUD endpoints + 同步 push/pull 验证 LogSync 写入
2. **前端**: 浏览器中完整操作流程 (创建→列表→编辑→删除)
3. **同步验证**: sync/push 后检查日志; 从移动端 sync/pull 检查数据同步
4. **回归**: 现有功能 (条目 CRUD, 分类, 账本, 笔记) 不受影响

---

## 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/app.module.ts` | 注册所有后端模块 |
| `src/core/connection-manager.ts` | USER_ENTITIES (Entity 注册) |
| `src/sync/log-runner.ts` | TYPE_MAP + replay 逻辑 |
| `src/entities/*.entity.ts` | 所有 Entity (已存在) |
| `src/enums/business-type.enum.ts` | BusinessType 枚举 (已含全部) |
| `src/items/item.service.ts` | 参考: LogSync 写入模式 |
| `web/src/api/index.ts` | 前端 API 层 |
| `web/src/router/index.ts` | 前端路由 |
| `web/src/views/Features.vue` | 功能中心入口 (P6 重构) |
| `web/src/components/Panel.vue` | UI 容器组件 |

---

## 单元测试现状

### 已完成 (63 tests, 7 suites)

| 测试文件 | 覆盖模块 | 用例数 | 语句覆盖 |
|---------|---------|-------|---------|
| `src/core/id.util.spec.ts` | generateId, generateToken | 6 | 100% |
| `src/entities/base.entity.spec.ts` | BaseEntity 层级 | 6 | 100% |
| `src/enums/enums.spec.ts` | 全部枚举 | 12 | 100% |
| `src/sync/log-runner.spec.ts` | CREATE/UPDATE/DELETE/BATCH 全分支 | 21 | 82% |
| `src/sync/materialize.service.spec.ts` | flush 并发去重/错误处理 | 6 | 100% |
| `src/items/item.service.spec.ts` | summary/statistics/create/remove | 12 | 56% |
| `src/sync/sync.service.spec.ts` | push/getStatus/ expiry tracking | 4 | 20% |

### 待补充

| 优先级 | 测试目标 | 预估用例 |
|-------|---------|---------|
| HIGH | LogRunner: BATCH_UPDATE ids+data 格式, BOOK 级联删除完整验证 | +5 |
| HIGH | SyncService: push/pull/initialSync (需 mock axios) | +15 |
| MEDIUM | ItemService: findAll 分页/过滤, update tag 管理 | +8 |
| MEDIUM | AttachmentService: upload/remove 文件 I/O (需 mock fs) | +5 |
| LOW | CRUD 服务共享测试 (Book/Category/Note/Shop/Tag/Project) | +20 |

---

## 开发进度 (2026-08-24)

### ✅ 已完成

| # | 功能 | 后端 | 前端 | 状态 |
|---|------|------|------|------|
| - | JWT 有效期延长 | `configuration.ts`: 24h → 90d | — | ✅ |
| - | 登录记住用户名 | — | `Login.vue`: checkbox + localStorage | ✅ |
| - | 单元测试 | 63 tests, 7 suites | — | ✅ |
| P6A | 统计图表增强 | — | `Statistics.vue`: echarts 饼图 + 时间范围(周/月/年/全部) + 日历热力图 + 结余 | ✅ |
| P5 附属 | 记事功能增强 | — | `Notes.vue`: 搜索 + 分组筛选 + 删除确认 | ✅ |
| P4 | 经期管理-后端 | `src/periods/` (Module/Controller/Service, 6 API) | — | ✅ |
| P4 | 经期管理-前端 | — | `Periods.vue`: 日历 + 状态卡 + 预测 + 日记录 | ✅ |
| P4 | 经期功能入口 | — | `Features.vue`: 经期记录入口 | ✅ |

### 🔄 进行中 / 待做

| # | 功能 | 优先级 | 状态 |
|---|------|-------|------|
| P1 | 债务管理 (后端+前端) | HIGH | 待开发 |
| P2A | 礼品卡 (后端+前端) | MED | 待开发 |
| P2B | 打卡活动 (后端+前端) | MED | 待开发 |
| P3A | 车辆加油 (后端+前端) | MED | 待开发 |
| P3B | 固定收支 (后端+前端) | MED | 待开发 |
| P3C | 记账规则 (后端+前端) | MED | 待开发 |
| P5A | 月报自动生成 | MED | 待开发 |
| P5B | 数据导入 | LOW | 待开发 |
| P5C | 用户分享 | LOW | 待开发 |
| P5D | 条目关联面板 | LOW | 待开发 |
| P6B | Tools Tab 重构 | LOW | 待开发 |
