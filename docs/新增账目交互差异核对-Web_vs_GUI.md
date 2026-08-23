# 新增账目交互差异核对报告：Web 端（clsswjz-agent）vs 移动端（clsswjz-gui）

> 核对日期：2026-08-23
> 状态：差异已核对，修复已实施（见文末「修复记录」）
> 核对范围：新增账目表单（分类 / 商户 / 项目 / 标签 / 账户 / 时间 选择与默认值）
> Web 端实现：`web/src/views/ItemForm.vue`（新增/编辑共用，`isNew` 区分）
> 移动端实现：`lib/pages/book/modern_item_form.dart` + `lib/providers/item_form_provider.dart`（`useNewItemForm` 开启的新版表单）
> 服务端：`src/items/item.service.ts`、`src/entities/account-item.entity.ts`

---

## 一、已发现问题的确认与根因

### 问题 1：分类「更多」与选中后的页面展示

**结论：属实，且有两处差异。**

| | Web 端（ItemForm.vue） | 移动端（modern_item_form.dart + common_select_form_field.dart） |
|---|---|---|
| 前 N 个展示 | `filteredCategories.slice(0, 8)` 固定前 8 个，**无排序**（L401） | `expandCount: 8, expandRows: 3`，**按智能评分倒序取前 8**（L512-535） |
| 选中项保底 | 无：经「更多」选中不在前 8 的分类后，**页面无对应 chip 高亮**，仅「更多」按钮 | **有**：选中项不在展示区时，会替换/追加到展示区末尾，保证选中分类始终可见（L540-555） |
| 「更多」面板 | 扁平单选列表（L200-223），无搜索 / 无树形 / 无创建 | `TreeSelectSheet`：**树形**（parentId 缩进 + 分支线 + 层级颜色）、**tree / recent / recommend 三种视图**、搜索、无结果直接创建（tree_select_sheet.dart） |
| 新建分类 | 独立「＋」弹窗，需填名称 + 编码（L264-281） | 面板内搜索无匹配时出现「新建」项，只填名称、编码自动（common_select_form_field.dart L367-383） |

**结构性根因**：agent 侧 `AccountCategory` 实体**没有 `parentId` 字段**（`src/entities/account-category.entity.ts`，仅 name/code/categoryType/lastAccountItemAt），而移动端分类表有 `parentId`（`lib/database/tables/account_category_table.dart:14`）。要做树形「更多」面板，需先确认同步协议中分类层级数据是否透传，或服务端补字段。

### 问题 2：账户默认选择

**结论：属实。**

- **Web 端**：`form.fundId = ''`（ItemForm.vue L383），初始显示「选择账户」，不选则保存 `fundId: null`。
- **移动端**：`ItemFormProvider` 构造新增 item 时 `fundId: bookMeta.defaultFundId`（item_form_provider.dart L110），**默认选中账本默认账户**；切换账本时同步更新为 `book.defaultFundId ?? 当前值`（L199）。
- **agent 数据层其实支持**：`AccountBook.defaultFundId`（account-book.entity.ts:14）、`AccountFund.isDefault`（account-fund.entity.ts:19）均已存在，Web 端只是未消费。

### 问题 3：新增账目没有时间值

**结论：属实，且会丢失数据精度。**

- **Web 端**：`accountTime: ''`（ItemForm.vue L388），时间徽标显示 `--:--`（L121）；保存时 `if (form.accountTime) accountDate = '${form.accountDate} ${form.accountTime}'`（L776）→ **无时间则只存 `YYYY-MM-DD`**。
- **移动端**：新增时 `_selectedTime = DateFormat('HH:mm').format(now)`（modern_item_form.dart L82），并写入 item，保存为 `YYYY-MM-DD HH:mm:ss`（item_form_provider.dart create 传完整 `accountDate`）。
- **服务端无兜底**：agent `ItemService.create` 直接 `repo.save` 入库，无默认时间处理（item.service.ts L87-106）→ Web 端传什么存什么。

---

## 二、其余差异（分类 / 商户 / 项目 / 标签选择）

| 维度 | Web 端 | 移动端 | 备注 |
|---|---|---|---|
| **标签** | **单选** badge → 单选 sheet（L107、L651-655） | **多选** `_TagBadge` → `MultiSelectSheet`，1 个显示名称、多个显示「N 个标签」（modern_item_form.dart L919-969） | **交互模型差异**：agent 实体 `AccountItem.tagCode` 为**单值**（account-item.entity.ts:29），移动端为 `tags` 列表 + `tagCodes`。Web 端做多选需先评估同步协议 |
| **商户** | 单选 sheet，无搜索 / 无树形 / 无创建（L648-650） | `TreeSelectFormField`：**树形** + 搜索 + **可直接创建**（`allowCreate: true`，modern_item_form.dart L571-605） | agent 商户实体同无 parentId（需确认） |
| **项目** | 单选 sheet，无搜索 / 无创建（L656-659） | badge 展示 + 搜索 + **可直接创建**（`onCreateItem` 创建 symbol，L667-682） | |
| **账户** | chip 单选（L74-84） | `iconText` 输入框样式（`SelectionTrigger`）+ required 校验（L548-568） | |
| **日期/时间** | 弹层内嵌 `el-date-picker` / `el-time-picker` | 原生 `showDatePicker` / `showTimePicker`（24h） | |
| 表单校验 | 保存时手动校验金额/分类（L807-815） | `Form` + `validator`（金额、分类、账户 required） | |

---

## 三、修复建议（按优先级）

### P0（数据正确性）
1. **时间默认值**：新增时 `accountTime` 默认 `nowTime()`，徽标显示当前时间；`buildPayload` 保持拼接逻辑，即可落库 `YYYY-MM-DD HH:mm`。
2. **账户默认选择**：`onMounted` 加载 funds 后，若 `form.fundId` 为空，优先取 `app.currentBook.defaultFundId`（book 数据已有），否则取 `isDefault` 账户，再退化为第一个账户；切换账本时同步重置。

### P1（交互对齐）
3. **分类选中保底展示**：`visibleCats` 计算时若选中分类不在前 8，将其替换/追加进展示区（照搬移动端 L540-555 逻辑）。
4. **分类/商户排序**：agent 分类已有 `lastAccountItemAt`，可先按最近使用排序；完整智能评分（时段/金额匹配）需引入近期账目数据。
5. **「更多」面板增强**：至少加搜索；树形展示依赖服务端补充 `parentId`（分类/商户实体需加字段 + 同步透传），需与 server 侧核对数据模型后再做。

### P2（需评估）
6. **标签多选**：移动端为多选，agent 实体为单值 `tagCode`，涉及同步协议与存储模型变更，建议单独立项评估。

## 四、修复记录（2026-08-23 已实施）

依据核对结果完成全量对齐，标签按「单独表存储」（`item_rel_field`，`fieldCode='TAG'`），`tagCode` 仅作历史兼容。

### 服务端（agent）
| 文件 | 改动 |
|---|---|
| `src/entities/item-rel-field.entity.ts` | 新增 `item_rel_field` 实体（itemId/fieldCode/fieldValue/sortOrder），对齐移动端 item_rel_field 表 |
| `src/core/connection-manager.ts` | 实体注册进 `USER_ENTITIES`（synchronize 自动建表） |
| `src/items/item.service.ts` | create/update 接收 `tagCodes` 数组并维护关联表；`tagCode` 取首值作兼容；findAll/findOne 附加 `tags`；remove 清理关联 |
| `src/sync/log-runner.ts` | 物化 ITEM 日志时维护多标签关联：CREATE/UPDATE 先删后插（含 BATCH），DELETE/BATCH_DELETE 清理；无标签字段的部分更新不动关联；首值回填 `tagCode` 兼容 |

### Web 前端
| 文件 | 改动 |
|---|---|
| `web/src/views/ItemForm.vue` | ①新增默认当前时间（`accountTime: nowTime()`）②账户默认 `defaultFundId`→`isDefault`→第一个，切账本重置 ③分类按 `lastAccountItemAt` 排序 + 选中项保底进前 8 ④分类/商户/项目「更多」弹层加搜索 + 无匹配直接创建 ⑤标签改**多选**（badge 显示「N 个标签」，多选弹层 + 搜索 + 创建）⑥保存校验账户必填 |
| `web/src/views/ItemsView.vue` / `ItemList.vue` | 列表标签改为多标签显示（`item.tags` 优先，兼容 `tagCode`） |

### 未实施项（数据模型前置）
- **智能评分**（时段/金额匹配排序）：agent 已有 `lastAccountItemAt`，已按最近使用排序兜底；完整评分需引入近期账目统计，后续可加。

---

## 五、后续补充（2026-08-23 第二轮）

### 1. 分类 / 商户树形「更多」面板（parentId 数据链路补齐）

**背景**：移动端树形依赖 `parentId`，此前 server / agent 分类与商户实体均无该字段，同步链路会丢弃层级 → 两端数据无法统一。

**改动**：
| 端 | 文件 | 改动 |
|---|---|---|
| server | `src/pojo/entities/account-category.entity.ts`、`account-shop.entity.ts` | 新增 `parent_id` 列（nullable，synchronize 自动迁移） |
| agent | `src/entities/account-category.entity.ts`、`account-shop.entity.ts` | 新增 `parentId` 列（synchronize 自动建表/迁移） |
| agent 同步 | `log-runner.ts`（sanitize 按列过滤） | 实体加列后自动透传物化，无需额外改动 |
| Web | `web/src/views/ItemForm.vue` | 分类/商户选择改为**树形面板**：`parentId` 层级缩进 + 展开/收起箭头 + 最近使用排序（子节点时间上浮）+ 搜索 + 无匹配创建 |

**数据链路**：移动端/Web 端创建带 `parentId` 的分类或商户 → 日志 operateData 携带 → server 物化落 `parent_id` → agent 拉取物化落本地 → Web 树形面板按层级渲染。两端统一。

### 2. 账目详情返回导航

`ItemForm.vue` 顶部新增返回栏（「返回」按钮 + 标题：新建记录/账目详情），`goBack()` 兼容无历史记录时回列表（`/items`）。

### 3. server 存量库落库保障 + 树形面板三视图（2026-08-23 第三轮）

**server 落库保障**：`database.config.ts` 新增 `ensureParentIdColumns()`，启动时幂等检查 `account_categories` / `account_shops` 是否缺 `parent_id` 列，缺则 `ALTER TABLE ADD COLUMN`（sqlite 用原生 sqlite3，mysql/pg 用临时连接查 information_schema）。已用 sqlite3 实证：存量库补列成功、老数据保留（parent_id 为 null）、新数据带 parentId 正常落库。从此 server 存量库也能落 parentId，不再依赖库重建。

**Web 树形面板三视图**（对齐移动端 TreeSelectSheet）：
- **智能推荐**（recommend）：JS 实现 `SmartSortService._compute`（频率 + 冷静期 + 时段 ±2h + 金额相似度），打开面板时异步拉近 30 天账目计算评分，按分倒序取 top20 扁平展示；有评分时默认进入推荐视图（用户手动切换后不覆盖）。
- **最近使用**（recent）：按 `lastAccountItemAt` 倒序 top20 扁平展示。
- **树形视图**（tree）：parentId 层级缩进 + 展开/收起 + 最近使用排序 + 搜索保留祖先链。
- 视图切换 tabs 显示条件与移动端一致（有评分显示「智能推荐」、有最近时间显示「最近使用」）。
- 实证：agent 本地 7724 条账目、近 30 天 110 条、267 分类/424 商户有使用记录，评分数据基础充足。

---

## 附：关键证据索引

| 差异点 | Web 端 | 移动端 |
|---|---|---|
| 分类展示/排序/保底 | ItemForm.vue L398-401、L678-681 | common_select_form_field.dart L508-558 |
| 分类树形「更多」 | ItemForm.vue L200-223（扁平） | tree_select_sheet.dart（tree/recent/recommend） |
| 账户默认值 | ItemForm.vue L383 | item_form_provider.dart L110、L199 |
| 时间默认值 | ItemForm.vue L388、L776 | modern_item_form.dart L72-84 |
| 标签单选/多选 | ItemForm.vue L107、L651-655 | modern_item_form.dart L919-969 |
| 商户树形+创建 | ItemForm.vue L86-96、L648-650 | modern_item_form.dart L571-605 |
| 实体差异 | account-item.entity.ts L29（tagCode 单值）、account-category.entity.ts（无 parentId） | account_category_table.dart L14（parentId）、user_item_vo.dart（tags 列表） |
