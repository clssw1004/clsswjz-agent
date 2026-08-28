<template>
  <div class="db-page">
    <!-- 头部：标题 + 只读徽标 + 表统计 -->
    <div class="db-head">
      <div class="db-title-row">
        <div class="db-logo"><el-icon :size="18"><Coin /></el-icon></div>
        <div>
          <div class="db-title">数据库</div>
          <div class="db-sub">本地 SQLite · 只读浏览</div>
        </div>
        <span class="db-badge" title="仅允许 SELECT 只读查询，不会修改任何数据">
          <el-icon :size="13"><Lock /></el-icon>只读
        </span>
      </div>
      <div v-if="tables.length" class="db-meta">
        <span>{{ tables.length }} 张表</span>
        <span class="dot"></span>
        <span>{{ totalRows.toLocaleString() }} 行</span>
      </div>
    </div>

    <!-- 主体 -->
    <div class="db-body">
      <!-- 数据区 -->
      <section class="db-main">
        <!-- 原始 SQL 查询 -->
        <div class="sql-box">
          <div class="sql-head">
            <span class="sql-label"><el-icon :size="14"><MagicStick /></el-icon> SQL 查询</span>
            <span class="sql-hint">仅 SELECT</span>
          </div>
          <div class="sql-row">
            <el-input
              v-model="sqlText"
              type="textarea"
              :rows="2"
              placeholder="SELECT * FROM account_items WHERE ...（Ctrl+Enter 运行）"
              class="sql-input"
              resize="none"
              @keydown.ctrl.enter.prevent="runQuery"
            />
            <button class="sql-run" :disabled="!sqlText.trim() || running" @click="runQuery">
              <el-icon v-if="running" class="spin"><Loading /></el-icon>
              <el-icon v-else :size="16"><VideoPlay /></el-icon>
              <span>运行</span>
            </button>
          </div>
          <div v-if="queryResult || queryError" class="sql-result-meta" :class="{ err: queryError }">
            <template v-if="queryError">
              <el-icon><CircleCloseFilled /></el-icon>{{ queryError }}
            </template>
            <template v-else>
              <el-icon><CircleCheckFilled /></el-icon>
              {{ queryResult.count }} 行
              <template v-if="queryResult.limited"> · 已自动限制 {{ limitText }} 行</template>
              <template v-else> · 未加限制</template>
            </template>
          </div>
        </div>

        <!-- 表数据 -->
        <div class="data-box">
          <div class="data-head">
            <div class="data-title-row">
              <button class="table-pick" :disabled="!tables.length" @click="openDrawer">
                <el-icon :size="15"><Coin /></el-icon>
                <span class="table-pick-name">{{ viewTitle }}</span>
                <el-icon :size="12" class="table-pick-caret"><ArrowDown /></el-icon>
              </button>
              <span v-if="currentMeta" class="data-sub">{{ currentMeta.total.toLocaleString() }} 行 · {{ displayCols.length }} 列</span>
            </div>
            <div class="data-actions">
              <!-- 仅表数据可分页：查询结果直接展示已限制的行数，不显示分页 -->
              <el-pagination
                v-if="currentTable && currentMeta && currentMeta.total > pageSize"
                :current-page="page"
                :page-size="pageSize"
                :total="currentMeta.total"
                :layout="isMobile ? 'prev, next' : 'prev, pager, next'"
                small
                background
                @current-change="changePage"
              />
            </div>
          </div>

          <div v-loading="loading" class="data-table-wrap">
            <!-- rows.length 优先于空态：SQL 查询结果 / 表数据都能渲染，空态只在真正无数据时出现 -->
            <template v-if="rows.length">
              <!-- 桌面端：现代表格 -->
              <div v-if="!isMobile" class="data-scroll">
                <table class="modern-table">
                  <thead>
                    <tr>
                      <th
                        v-for="c in displayCols"
                        :key="c.name"
                        class="th-cell"
                        :class="typeClass(c)"
                      >
                        <span class="th-name">{{ c.name }}</span>
                        <span v-if="c.type" class="th-type" :class="'kind-' + kindByColumn(c)">
                          <span class="th-type-sym">{{ typeSymbol(c) }}</span>
                          <span class="th-type-txt">{{ c.type }}</span>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ri) in rows" :key="ri">
                      <td
                        v-for="c in displayCols"
                        :key="c.name"
                        class="td-cell"
                        :class="cellClass(c, row[c.name])"
                      >
                        <template v-if="isJson(c, row[c.name])">
                          <span class="json-preview" :title="row[c.name]">{{ row[c.name] }}</span>
                          <button class="json-chip" @click="openJson(c.name, row[c.name])">JSON</button>
                        </template>
                        <template v-else-if="isNull(row[c.name])">
                          <span class="null-val">NULL</span>
                        </template>
                        <template v-else>
                          <span class="cell-val" :title="String(row[c.name])">{{ formatCellValue(c, row[c.name]) }}</span>
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- 移动端：卡片列表（不横向滚动） -->
              <div v-else class="card-list">
                <div v-for="(row, ri) in rows" :key="ri" class="row-card">
                  <div class="row-card-head">
                    <span class="row-card-index num">{{ pageStart + ri }}</span>
                    <span class="row-card-id" :title="cardId(row, ri)">{{ cardId(row, ri) }}</span>
                    <button
                      class="row-card-copy"
                      type="button"
                      title="复制 ID"
                      aria-label="复制 ID"
                      @click.stop="copyId(row, ri)"
                    >
                      <el-icon :size="12"><CopyDocument /></el-icon>
                    </button>
                  </div>
                  <div class="row-card-fields">
                    <!-- 关键字段：信息价值评分高的短字段优先展示 -->
                    <div
                      v-for="c in cardPrimaryCols"
                      :key="c.name"
                      class="row-card-field"
                    >
                      <span
                        v-if="c.type"
                        class="type-symbol"
                        :class="'kind-' + kindByColumn(c)"
                        :title="c.type"
                      >{{ typeSymbol(c) }}</span>
                      <span class="field-label" :title="c.name + (c.type ? ' · ' + c.type : '')">{{ c.name }}</span>
                      <span class="field-value" :class="cellClass(c, row[c.name])">
                        <template v-if="isJson(c, row[c.name])">
                          <button class="json-chip" @click="openJson(c.name, row[c.name])">JSON</button>
                        </template>
                        <template v-else-if="isNull(row[c.name])">
                          <span class="null-val">NULL</span>
                        </template>
                        <template v-else>{{ formatCellValue(c, row[c.name]) }}</template>
                      </span>
                    </div>
                  </div>
                  <!-- 其余字段折叠，点击展开（避免每张卡片 13 列全平铺导致高度失控） -->
                  <details v-if="cardDetailCols.length" class="row-card-details">
                    <summary>其余 {{ cardDetailCols.length }} 个字段</summary>
                    <div class="row-card-fields">
                      <div
                        v-for="c in cardDetailCols"
                        :key="c.name"
                        class="row-card-field"
                      >
                        <span class="field-label" :title="c.name + (c.type ? ' · ' + c.type : '')">{{ c.name }}</span>
                        <span
                          v-if="c.type"
                          class="type-symbol"
                          :class="'kind-' + typeKind(c.type)"
                          :title="c.type"
                        >{{ typeSymbol(c.type) }}</span>
                        <span class="field-value" :class="cellClass(c, row[c.name])">
                          <template v-if="isJson(c, row[c.name])">
                            <button class="json-chip" @click="openJson(c.name, row[c.name])">JSON</button>
                          </template>
                          <template v-else-if="isNull(row[c.name])">
                            <span class="null-val">NULL</span>
                          </template>
                          <template v-else>{{ formatCellValue(c, row[c.name]) }}</template>
                        </span>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </template>
            <!-- 空态：仅在非加载且确实无行时显示 -->
            <el-empty
              v-else-if="!loading"
              :description="queryResult ? '查询无结果，请调整 SQL' : (!currentTable ? '选择一张表，或在上方执行 SQL' : '暂无数据')"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- 表选择抽屉（移动端底部滑入，桌面端右侧滑入；方向在打开前锁定，避免弹层动画期间改尺寸导致高度抖动） -->
    <el-drawer
      v-model="drawer"
      title="选择表"
      :size="drawerSize"
      :direction="drawerDirection"
      class="table-drawer"
      :show-close="drawerDirection === 'rtl'"
      :lock-scroll="false"
    >
      <div v-if="drawerDirection === 'btt'" class="drawer-handle"></div>
      <div class="drawer-search">
        <el-input
          v-model="search"
          placeholder="搜索表名"
          clearable
          :prefix-icon="Search"
          size="large"
          autofocus
        />
      </div>
      <div class="drawer-list">
        <button
          v-for="t in filteredTables"
          :key="t.name"
          class="drawer-item"
          :class="{ on: currentTable === t.name }"
          @click="pickTable(t.name)"
        >
          <span class="drawer-item-name">{{ t.name }}</span>
          <span class="drawer-item-count">{{ t.count.toLocaleString() }} 行</span>
          <el-icon v-if="currentTable === t.name" class="drawer-item-check"><CircleCheckFilled /></el-icon>
        </button>
        <div v-if="!filteredTables.length" class="drawer-empty">
          <el-empty description="无匹配表" :image-size="60" />
        </div>
      </div>
    </el-drawer>

    <!-- JSON 详情抽屉 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="jsonVisible" class="json-mask" role="dialog" aria-modal="true" aria-label="JSON 详情" @click.self="jsonVisible = false">
          <div class="json-sheet">
            <div class="json-head">
              <span class="json-title">{{ jsonTitle }}</span>
              <button class="json-close" aria-label="关闭" @click="jsonVisible = false"><el-icon><Close /></el-icon></button>
            </div>
            <pre class="json-body">{{ jsonContent }}</pre>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  Coin, Lock, Search, MagicStick, VideoPlay, Loading, CopyDocument,
  CircleCheckFilled, CircleCloseFilled, Close, ArrowDown,
} from '@element-plus/icons-vue';
import { dbViewerApi } from '@/api';
import { useResponsive } from '@/composables/useResponsive';

const { isMobile } = useResponsive();
const PAGE_SIZE = 50;

const tables = ref<{ name: string; count: number }[]>([]);
const search = ref('');
const currentTable = ref('');
const currentMeta = ref<any>(null);
const rows = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(PAGE_SIZE);
const loading = ref(false);

// SQL 查询区
const sqlText = ref('');
const running = ref(false);
const queryResult = ref<any>(null);
const queryError = ref('');

// 表选择抽屉
const drawer = ref(false);
/** 抽屉打开时锁定的方向/尺寸（避免运行中响应式切换导致抽屉大小抖动） */
const drawerMode = ref<{ direction: 'rtl' | 'btt'; size: number | string }>({ direction: 'rtl', size: 360 });
const drawerDirection = computed(() => drawerMode.value.direction);
const drawerSize = computed(() => drawerMode.value.size);

function lockDrawerMode() {
  drawerMode.value = isMobile.value
    ? { direction: 'btt', size: '72vh' }
    : { direction: 'rtl', size: 360 };
}

/** 打开表选择抽屉：先按当前断点锁定方向/尺寸，再弹出（保证弹层动画全程尺寸稳定，避免"时高时低"） */
function openDrawer() {
  lockDrawerMode();
  drawer.value = true;
}

// JSON 抽屉
const jsonVisible = ref(false);
const jsonTitle = ref('');
const jsonContent = ref('');

const filteredTables = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return tables.value;
  return tables.value.filter((t) => t.name.toLowerCase().includes(q));
});

const totalRows = computed(() => tables.value.reduce((s, t) => s + t.count, 0));

const displayCols = computed(() => {
  // 优先用 currentMeta.columns（带 type）：保证 th-type、cellClass 的 num/date 着色真正生效，
  // 避免之前「优先用行 key 反推、type 永远为空」导致表头类型标签/数字右对齐/日期色全部失效的 bug
  const metaCols = currentMeta.value?.columns;
  if (Array.isArray(metaCols) && metaCols.length) {
    return metaCols.map((c: any) => ({ name: c.name, type: c.type || '' }));
  }
  // 兜底：行 key 推列名 + 用值推断 type（让 th-type 在 columns 缺失时也能展示）
  const first = Array.isArray(rows.value) ? rows.value[0] : null;
  if (first) {
    return Object.keys(first).map((name) => ({ name, type: inferType(name, first[name]) }));
  }
  return [];
});

/** 从值推断 SQLite 类型，用于后端 columns 缺失时的兜底 */
function inferType(name: string, val: any): string {
  if (val == null) return '';
  if (typeof val === 'number') return Number.isInteger(val) ? 'INTEGER' : 'REAL';
  if (typeof val === 'boolean') return 'INTEGER';
  if (typeof val !== 'string') return '';
  const s = val.trim();
  if (!s) return '';
  // JSON
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try { JSON.parse(s); return 'JSON'; } catch { /* fallthrough */ }
  }
  // ISO 日期 / 13 位毫秒
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return 'DATETIME';
  if (/^\d{10,13}$/.test(s) && Number(s) > 10_000_000_000) return 'DATETIME';
  // 日期
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'DATE';
  return 'TEXT';
}

/** 主视图标题：优先当前表，SQL 结果显示「SQL 结果」，否则提示选择 */
const viewTitle = computed(() => currentTable.value || (queryResult.value ? 'SQL 结果' : '选择表'));

/**
 * 移动端卡片关键字段评分：
 *  - 字段名命中常见业务标识（id/name/code/type/金额/日期等）加分
 *  - 值越短分越高（hash、时间戳等长值不占关键位）
 *  - 按得分取前 6 个展示，其余折叠进「其余 N 个字段」details
 */
const KEY_HINT = /^(id|_?id|name|title|label|code|type|category|categoryType|bookId|accountBookId|amount|price|count|sort|sortOrder|date|time|happenedAt|createdAt|updatedAt|parentId)$/i;

function fieldScore(c: any, row: any): number {
  let s = 0;
  if (KEY_HINT.test(c.name)) s += 2;
  const v = row?.[c.name];
  const len = v == null ? 0 : String(v).length;
  if (len <= 16) s += 1;
  if (len > 32) s -= 2;
  if (isJson(c, v)) s -= 1;
  return s;
}

/** 移动端关键字段（得分 top N，保持列序；id/_id 已在卡片头展示，从字段列表剔除） */
const cardPrimaryCols = computed(() => {
  const cols = displayCols.value.filter((c) => !/^(id|_id)$/i.test(c.name));
  const first = Array.isArray(rows.value) ? rows.value[0] : null;
  if (!cols.length) return [];
  const ranked = cols
    .map((c, i) => ({ c, i, s: fieldScore(c, first) }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const top = new Set(ranked.slice(0, Math.min(6, cols.length)).map((r) => r.i));
  return cols.filter((_, i) => top.has(i));
});

/** 移动端折叠字段（其余列，保持列序；同样剔除 id/_id） */
const cardDetailCols = computed(() => {
  const cols = displayCols.value.filter((c) => !/^(id|_id)$/i.test(c.name));
  if (!cols.length) return [];
  const pk = new Set(cardPrimaryCols.value.map((c) => c.name));
  return cols.filter((c) => !pk.has(c.name));
});

/** 移动端卡片头部 ID：优先 id/_id，缺失则回退为记录序号 */
function cardId(row: any, ri: number): string {
  const id = row?.id ?? row?._id;
  if (id !== null && id !== undefined && id !== '') return String(id);
  return `记录 ${pageStart.value + ri}`;
}

/** 复制 ID 到剪贴板（卡片头复制按钮） */
async function copyId(row: any, ri: number) {
  const id = cardId(row, ri);
  try {
    await navigator.clipboard.writeText(id);
  } catch {
    // 旧浏览器/非安全上下文回退：textarea 选中复制
    const ta = document.createElement('textarea');
    ta.value = id;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(ta);
  }
}

/**
 * 列语义分类：字段名 + 类型共同决定（与 cellClass 同一套规则，保证 type-symbol 与值颜色一致）
 *  - 固定字段优先：id/_id/uid/key → pk；name → name；code → code；is/has/can 前缀 → bool
 *  - 字段名含 at/date/time 或类型 DATE/TIME → date
 *  - 数字类型 → num；JSON/BLOB → json；其他 → text
 */
function kindByColumn(c: any): string {
  const name = String(c.name || '');
  const t = String(c.type || '').toUpperCase();
  if (/^(id|_id|uid|key)$/i.test(name)) return 'pk';
  if (/^name$/i.test(name)) return 'name';
  if (/^code$/i.test(name)) return 'code';
  if (/^(is|has|can|should|enable|disabled)\w*$/i.test(name)) return 'bool';
  if (/(at|date|time)$/i.test(name) || /date|time/i.test(t)) return 'date';
  if (/INT|DECIMAL|REAL|NUM|FLOAT|DOUBLE/.test(t)) return 'num';
  if (/JSON|BLOB/i.test(t)) return 'json';
  return 'text';
}

/** 类型符号：用几个符号区分类型（对齐设计稿的 chip 语义，避免长类型名截断） */
const TYPE_SYMBOL: Record<string, string> = {
  num: '#',
  text: 'Aa',
  date: '⟳',
  json: '{ }',
  bool: '✓',
  unknown: '?',
};

/** 取列对应 type-symbol（基于字段名+类型，与 cellClass 颜色一致） */
function typeSymbol(c: any): string {
  const k = kindByColumn(c);
  // pk/name/code 都是文本类字段，符号用 'Aa' 即可；分类仍走 kind-* 给颜色
  if (k === 'pk' || k === 'name' || k === 'code') return 'Aa';
  return TYPE_SYMBOL[k] || 'Aa';
}

/** 13 位毫秒时间戳 / ISO 日期格式化；按值格式自动判断，不依赖 typeKind 早返回
 * （避免 BIGINT 类型列名如 createdAt 被识别为 num 跳过格式化） */
function formatCellValue(c: any, v: any): string {
  if (v === null || v === undefined || typeof v === 'object') return v;
  const s = String(v);
  // 13 位毫秒时间戳（createdAt/updatedAt 等 BIGINT 字段都走这里）
  if (/^\d{13}$/.test(s)) {
    const d = new Date(Number(s));
    if (!isNaN(d.getTime())) return fmtDateTime(d);
  }
  // 10 位秒时间戳
  if (/^\d{10}$/.test(s)) {
    const d = new Date(Number(s) * 1000);
    if (!isNaN(d.getTime())) return fmtDateTime(d);
  }
  // ISO T 分隔 → 空格
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    return s.replace('T', ' ');
  }
  // "2025-12-31 10:42:00.000" 去毫秒
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+$/.test(s)) {
    return s.replace(/\.\d+$/, '');
  }
  return s;
}

function fmtDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 当前页起始行号（移动端卡片序号） */
const pageStart = computed(() => (page.value - 1) * pageSize.value + 1);

/** SQL 查询的自动限制行数（后端响应没有 pageSize 字段，限制值来自前端请求的 PAGE_SIZE） */
const limitText = computed(() => PAGE_SIZE.toLocaleString());

async function loadTables() {
  try {
    const res: any = await dbViewerApi.tables();
    tables.value = (res || []).map((t: any) => ({ name: t.name, count: Number(t.count || 0) }));
    if (!currentTable.value && tables.value.length) selectTable(tables.value[0].name);
  } catch { /* 401 等由拦截器处理 */ }
}

async function selectTable(name: string) {
  currentTable.value = name;
  page.value = 1;
  await loadData();
}

/** 抽屉中选中表：切换并关闭抽屉 */
function pickTable(name: string) {
  drawer.value = false;
  search.value = '';
  selectTable(name);
}

let loadSeq = 0;

async function loadData() {
  if (!currentTable.value) return;
  const seq = ++loadSeq;
  loading.value = true;
  queryResult.value = null;
  queryError.value = '';
  // 保留 rows 旧值让 v-loading 遮罩盖住，避免清空导致卡片/表格高度突变（切表时布局错乱）
  // 仅清 currentMeta 让 displayCols 退到 rows 兜底分支，新数据返回后整体替换
  currentMeta.value = null;
  try {
    const res: any = await dbViewerApi.tableData(currentTable.value, {
      page: page.value,
      pageSize: pageSize.value,
    });
    // 仅当本次请求仍是最近一次时写入，避免快速切表时旧响应覆盖新数据
    if (seq !== loadSeq) return;
    // 若后端返回行数据但列定义缺失（如 PRAGMA 未返回列的表），用行 key 反推列，避免"有行无表头"的空洞表格
    currentMeta.value = ensureColumns(res, res.rows);
    rows.value = Array.isArray(res.rows) ? res.rows : [];
  } catch {
    if (seq !== loadSeq) return;
    // 加载失败：保留旧 rows（避免空白），清空 meta
    currentMeta.value = null;
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

async function changePage(p: number) {
  if (!currentTable.value) return; // 查询结果不分页，忽略无效翻页
  page.value = p;
  await loadData();
}

async function runQuery() {
  const sql = sqlText.value.trim();
  if (!sql || running.value) return;
  running.value = true;
  queryError.value = '';
  // 使在途的 loadData 失效，避免其响应覆盖 SQL 结果；同时记录本次序号让查询结果也受保护
  const seq = ++loadSeq;
  page.value = 1; // 回到首页，避免移动端卡片序号从中间页开始
  try {
    const res: any = await dbViewerApi.query(sql, PAGE_SIZE);
    if (seq !== loadSeq) return; // 期间用户已切表/翻页，丢弃过期查询结果
    queryResult.value = res;
    // 查询结果直接作为表格展示（覆盖表数据视图）；查询结果同样用行 key 兜底列，防空洞
    currentMeta.value = ensureColumns({
      table: 'SQL 结果',
      total: res.count,
      columns: (res.columns || []).map((n: string) => ({ name: n, type: '' })),
    }, res.rows);
    rows.value = res.rows || [];
    currentTable.value = '';
    loading.value = false; // 吸收被打断的 loadData 残留 loading，避免表格区遮罩常驻
  } catch (e: any) {
    if (seq !== loadSeq) return; // 过期错误不覆盖当前视图
    queryError.value = e?.response?.data?.message || e?.message || '查询失败';
    // 查询失败不切换视图：保留当前表/上次结果，仅在上方提示错误
    queryResult.value = null;
    loading.value = false; // 吸收被打断的 loadData 残留 loading
  } finally {
    if (seq === loadSeq) running.value = false;
  }
}

/* ---------- 单元格渲染辅助 ---------- */
/**
 * 归一化表数据元信息：后端返回 rows 但 columns 缺失/为空时（如某些表 PRAGMA 未返回列），
 * 用第一行的 key 反推（name + 空 type），保证表头/卡片字段 label 始终与数据对齐，不出现"有行无表头"空洞。
 */
function ensureColumns(meta: any, rows: any[]): any {
  if (!meta) return meta;
  const cols = Array.isArray(meta.columns) ? meta.columns : [];
  if (cols.length) return meta;
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) return meta;
  const derived = Object.keys(first).map((name) => ({ name, type: '' }));
  return { ...meta, columns: derived };
}

function isNull(v: any): boolean {
  return v === null || v === undefined;
}

function isJson(c: any, v: any): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'object') return true;
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  if (!(s.startsWith('{') || s.startsWith('['))) return false;
  try { JSON.parse(s); return true; } catch { return false; }
}

function isLong(v: any): boolean {
  if (typeof v !== 'string') return false;
  return v.length > 80;
}

function openJson(col: string, v: any) {
  let parsed = v;
  if (typeof v === 'string') {
    try { parsed = JSON.parse(v); } catch { /* keep raw */ }
  }
  jsonTitle.value = `${currentTable.value || 'SQL 结果'} · ${col}`;
  jsonContent.value = JSON.stringify(parsed, null, 2);
  jsonVisible.value = true;
}

function typeClass(c: any) {
  const t = String(c.type || '').toUpperCase();
  if (t.includes('INT') || t.includes('DECIMAL') || t.includes('REAL') || t.includes('NUM')) return 'num';
  if (t.includes('DATE') || t.includes('TIME')) return 'date';
  return '';
}

/** 类型 chip 分类：决定 th-type 的颜色（对齐画布：数字 teal / 文本 indigo / 日期 cyan / JSON purple / 布尔 amber） */
function typeKind(t: any): string {
  const s = String(t || '').toUpperCase();
  if (!s) return 'unknown';
  if (s.includes('INT') || s.includes('DECIMAL') || s.includes('REAL') || s.includes('NUM') || s.includes('FLOAT') || s.includes('DOUBLE')) return 'num';
  if (s.includes('DATE') || s.includes('TIME')) return 'date';
  if (s === 'JSON' || s.includes('JSON') || s.includes('BLOB')) return 'json';
  if (s.includes('BOOL')) return 'bool';
  return 'text';
}

/**
 * 单元格视觉分类：按固定字段名 / 类型给值上色（对齐画布设计稿）
 *  - id/_id      → pk   主键（深色加粗等宽）
 *  - name        → name 主名称（加粗）
 *  - code        → code 编码（indigo 等宽）
 *  - 日期字段/类型 → date 青色
 *  - 数字        → num  teal 右对齐
 *  - 布尔        → bool amber
 *  - JSON / NULL 单独处理
 */
function cellClass(c: any, v: any) {
  if (isNull(v)) return 'null';
  if (isJson(c, v)) return 'json';
  const name = String(c.name || '');
  const t = String(c.type || '').toUpperCase();
  // 固定字段特殊样式（优先于类型推断）
  if (/^(id|_id|uid|key)$/i.test(name)) return 'pk';
  if (/^name$/i.test(name)) return 'name';
  if (/^code$/i.test(name)) return 'code';
  // 布尔语义字段（is/has/can 前缀）
  if (/^(is|has|can|should|enable|disabled)\w*$/i.test(name)) return 'bool';
  // 日期：字段名含 at/date/time，或类型为日期
  if (/(at|date|time)$/i.test(name) || /date|time/i.test(t)) return 'date';
  if (/INT|DECIMAL|REAL|NUM|FLOAT|DOUBLE/.test(t)) return 'num';
  return '';
}

onMounted(() => {
  loadTables();
  // ESC 关闭 JSON 抽屉（焦点管理辅助）
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && jsonVisible.value) {
    jsonVisible.value = false;
  }
}
</script>

<style scoped>
.db-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

/* ========== 头部 ========== */
.db-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  padding: 14px 18px;
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
}

.db-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.db-logo {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #fff;
  background: var(--grad-cyan);
}

.db-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.25;
}

.db-sub {
  font-size: 12px;
  color: var(--text-3);
}

.db-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-gold-dark);
  background: var(--brand-gold-soft);
  border: 1px solid rgba(20, 184, 166, 0.25);
  white-space: nowrap;
}

.db-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

.db-meta .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-3);
  opacity: 0.5;
}

/* ========== 主体 ========== */
.db-body {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
}

/* ========== 表选择按钮 ========== */
.table-pick {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 320px;
  padding: 7px 14px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  background: var(--surface-active);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
}

.table-pick:hover:not(:disabled) {
  border-color: var(--border-glass-strong);
  background: var(--surface-hover);
}

.table-pick:active:not(:disabled) {
  transform: scale(0.98);
}

.table-pick:disabled {
  opacity: 0.5;
  cursor: default;
}

.table-pick .el-icon {
  color: var(--brand-gold);
  flex-shrink: 0;
}

.table-pick-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 12.5px;
}

.table-pick-caret {
  color: var(--text-3) !important;
  font-size: 12px;
  transition: transform 0.2s ease;
}

/* ========== 表选择抽屉 ========== */
.table-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 18px 20px 10px;
  color: var(--text-1);
  font-weight: 700;
  border-bottom: 1px solid var(--border-glass);
}

.table-drawer :deep(.el-drawer__body) {
  padding: 14px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-search {
  flex-shrink: 0;
}

.drawer-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overscroll-behavior: contain;
}

.drawer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.drawer-item:hover {
  background: var(--surface-hover);
}

.drawer-item.on {
  background: var(--brand-gold-soft);
}

.drawer-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}

.drawer-item-count {
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.drawer-item-check {
  color: var(--brand-gold);
  flex-shrink: 0;
  font-size: 15px;
}

.drawer-empty {
  padding: 30px 0;
}

/* 底部抽屉把手（移动端） */
.drawer-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-3);
  opacity: 0.4;
  margin: 0 auto 12px;
  flex-shrink: 0;
}

/* ========== 移动端卡片列表（替代表格，避免横向滚动） ========== */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.row-card {
  border-radius: var(--radius-md);
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.row-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  min-height: 30px;
  background: rgba(15, 23, 42, 0.025);
  border-bottom: 1px solid var(--border-glass);
  font-size: 11px;
  color: var(--text-3);
  min-width: 0;
}

.row-card-index {
  font-weight: 700;
  color: var(--brand-gold);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.row-card-id {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-3);
}

/* 卡片头复制按钮 */
.row-card-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.row-card-copy:hover {
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
}

.row-card-copy:active {
  transform: scale(0.92);
}

.row-card-fields {
  display: flex;
  flex-direction: column;
  padding: 2px 0;
}

.row-card-field {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 12px;
  min-height: 34px;
  min-width: 0;
}

/* 类型符号：置于字段名前，独立列（小方块 chip） */
.type-symbol {
  font-style: normal;
  font-weight: 700;
  font-size: 8.5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  line-height: 1;
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.type-symbol.kind-num { color: #0d9488; background: rgba(20, 184, 166, 0.12); }
.type-symbol.kind-text { color: #6366f1; background: #eef2ff; }
.type-symbol.kind-date { color: #0891b2; background: #ecfeff; }
.type-symbol.kind-json { color: #8b5cf6; background: #faf5ff; }
.type-symbol.kind-bool { color: #b45309; background: #fef3c7; }
.type-symbol.kind-pk { color: #0d9488; background: rgba(20, 184, 166, 0.12); }
.type-symbol.kind-name { color: var(--text-1); background: rgba(15, 23, 42, 0.05); }
.type-symbol.kind-code { color: #6366f1; background: #eef2ff; }
.type-symbol.kind-unknown { color: var(--text-3); background: var(--surface-active); border: 1px solid var(--border-glass); }

.row-card-field + .row-card-field {
  border-top: 1px dashed var(--border-glass);
}

/* 折叠详情：其余字段 */
.row-card-details {
  border-top: 1px dashed var(--border-glass);
  margin-top: 2px;
}

.row-card-details summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  min-height: 34px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.row-card-details summary::-webkit-details-marker {
  display: none;
}

.row-card-details summary::before {
  content: '';
  width: 5px;
  height: 5px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.row-card-details[open] summary::before {
  transform: rotate(-135deg) translateY(-1px);
}

.row-card-details summary:hover {
  color: var(--brand-gold-dark);
  background: var(--surface-hover);
}

.row-card-details .row-card-fields {
  border-top: 1px dashed var(--border-glass);
}

.field-label {
  flex-shrink: 0;
  width: 92px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-3);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-value {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-1);
  word-break: break-all;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  text-align: left;
}

/* 值按类型着色（与类型 chip 颜色保持一致） */
.field-value.num { color: #0d9488; }
.field-value.date { color: #0891b2; }
.field-value.bool { color: #b45309; }
.field-value.pk { color: var(--text-1); font-weight: 700; font-family: var(--font-mono); }
.field-value.name { color: var(--text-1); font-weight: 600; }
.field-value.code { color: #6366f1; font-family: var(--font-mono); }

/* ========== 数据区 ========== */
.db-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* SQL 查询框 */
.sql-box {
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  padding: 14px 16px;
}

.sql-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.sql-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.sql-hint {
  font-size: 11px;
  color: var(--text-3);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
}

.sql-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.sql-input {
  flex: 1;
}

.sql-input :deep(.el-textarea__inner) {
  font-family: var(--font-mono);
  font-size: 12.5px;
  background: var(--code-bg);
  border-color: var(--border-glass);
  color: var(--text-1);
  line-height: 1.6;
}

.sql-run {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 18px;
  border: none;
  border-radius: var(--radius-md);
  color: var(--on-primary);
  background: var(--grad-brand);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
  flex-shrink: 0;
}

.sql-run:hover:not(:disabled) {
  opacity: 0.9;
}

.sql-run:active:not(:disabled) {
  transform: scale(0.97);
}

.sql-run:disabled {
  opacity: 0.5;
  cursor: default;
}

.sql-result-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-success);
}

.sql-result-meta.err {
  color: var(--brand-red);
}

.sql-result-meta.err :deep(.el-icon) {
  font-size: 14px;
}

.spin {
  animation: rotate 0.9s linear infinite;
}

@keyframes rotate {
  to { transform: rotate(360deg); }
}

/* 表数据卡 */
.data-box {
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.data-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border-glass);
}

.data-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.data-sub {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

.data-actions {
  flex-shrink: 0;
}

.data-table-wrap {
  min-height: 160px;
}

.data-scroll {
  overflow: auto;
  max-height: calc(100vh - 420px);
  min-height: 160px;
}

/* ========== 现代表格 ========== */
.modern-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.modern-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--surface-active);
  text-align: left;
  padding: 13px 14px 11px;
  border-bottom: 1px solid var(--border-glass-strong);
  white-space: nowrap;
}

.th-cell {
  min-width: 110px;
}

.th-cell > span {
  display: block;
}

.th-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  font-family: var(--font-mono);
}

.th-type {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 3px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.02em;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.th-type-sym {
  font-size: 9px;
  font-weight: 700;
}

/* 类型 chip 分类色（对齐画布设计稿） */
.th-type.kind-num {
  color: #0d9488;
  background: rgba(20, 184, 166, 0.1);
}

.th-type.kind-text {
  color: #6366f1;
  background: #eef2ff;
}

.th-type.kind-date {
  color: #0891b2;
  background: #ecfeff;
}

.th-type.kind-json {
  color: #8b5cf6;
  background: #faf5ff;
}

.th-type.kind-bool {
  color: #b45309;
  background: #fef3c7;
}

.th-type.kind-unknown {
  color: var(--text-3);
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
}

.modern-table tbody td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-glass);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.modern-table tbody tr:last-child td {
  border-bottom: none;
}

.modern-table tbody tr {
  transition: background 0.12s ease;
}

.modern-table tbody tr:hover {
  background: var(--surface-hover);
}

.td-cell.num,
.th-cell.num {
  text-align: right;
}

.td-cell.date {
  color: #0891b2;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

/* 固定字段值特殊样式（对齐画布：主键深色加粗 / 编码 indigo / 数字 teal / 布尔 amber） */
.td-cell.pk {
  color: var(--text-1);
  font-weight: 700;
  font-family: var(--font-mono);
}

.td-cell.name {
  color: var(--text-1);
  font-weight: 600;
}

.td-cell.code {
  color: #6366f1;
  font-family: var(--font-mono);
  font-size: 12px;
}

.td-cell.num {
  color: #0d9488;
}

.td-cell.bool {
  color: #b45309;
}

.cell-val {
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.null-val {
  color: var(--text-3);
  opacity: 0.6;
  font-style: italic;
  font-size: 11px;
}

/* JSON 单元格：左侧截断预览 + 右侧 chip */
.td-cell.json {
  display: flex;
  align-items: center;
  gap: 6px;
}

.json-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-3);
}

.json-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-glass-strong);
  background: var(--brand-purple-soft);
  color: var(--brand-purple);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.12s ease;
}

.json-chip:hover {
  transform: scale(1.06);
}

/* ========== JSON 抽屉 ========== */
.json-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(4, 8, 18, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.json-sheet {
  width: 100%;
  max-width: 560px;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-glass-strong);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: 20px 20px 0 0;
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}

.json-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-glass);
}

.json-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.json-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--surface-active);
  color: var(--text-2);
  cursor: pointer;
  flex-shrink: 0;
}

.json-body {
  margin: 0;
  padding: 16px 18px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-1);
  white-space: pre-wrap;
  word-break: break-all;
}

/* 弹层过渡 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}

.sheet-enter-active .json-sheet,
.sheet-leave-active .json-sheet {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .json-sheet,
.sheet-leave-to .json-sheet {
  transform: translateY(100%);
}

/* ========== 响应式 ========== */
@media (max-width: 767px) {
  .db-body {
    flex-direction: column;
  }

  .table-pick {
    max-width: 160px;
  }

  .data-head {
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .data-actions {
    min-width: 0;
  }

  /* 底部滑入抽屉：顶部圆角 + 遮罩层次 */
  .table-drawer {
    width: 100% !important;
    max-width: 100%;
    border-radius: 18px 18px 0 0;
  }

  .table-drawer :deep(.el-drawer__header) {
    padding-top: 6px;
    justify-content: center;
  }

  .table-drawer :deep(.el-drawer__title) {
    font-size: 15px;
  }

  .sql-row {
    flex-direction: column;
  }

  .sql-input {
    flex: none;
    width: 100%;
  }

  .sql-run {
    justify-content: center;
    padding: 10px 0;
  }

  .db-meta {
    display: none;
  }
}

/* 尊重系统减弱动态偏好 */
@media (prefers-reduced-motion: reduce) {
  .table-drawer :deep(.el-drawer),
  .json-sheet,
  .row-card {
    transition: none !important;
  }
}

/* ========== 暗色模式适配：类型 chip / 固定字段色 / 值着色改用亮色系 ========== */
html.dark .type-symbol.kind-num,
html.dark .th-type.kind-num {
  color: #2dd4bf;
  background: rgba(45, 212, 191, 0.16);
}

html.dark .type-symbol.kind-text,
html.dark .th-type.kind-text {
  color: #a5b4fc;
  background: rgba(165, 180, 252, 0.15);
}

html.dark .type-symbol.kind-date,
html.dark .th-type.kind-date {
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.15);
}

html.dark .type-symbol.kind-json,
html.dark .th-type.kind-json {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.16);
}

html.dark .type-symbol.kind-bool,
html.dark .th-type.kind-bool {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
}

html.dark .type-symbol.kind-pk,
html.dark .th-type.kind-pk {
  color: #2dd4bf;
  background: rgba(45, 212, 191, 0.16);
}

html.dark .type-symbol.kind-code,
html.dark .th-type.kind-code {
  color: #a5b4fc;
  background: rgba(165, 180, 252, 0.15);
}

html.dark .type-symbol.kind-name,
html.dark .th-type.kind-name {
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.07);
}

html.dark .field-value.num,
html.dark .td-cell.num {
  color: #2dd4bf;
}

html.dark .field-value.date,
html.dark .td-cell.date {
  color: #22d3ee;
}

html.dark .field-value.code,
html.dark .td-cell.code {
  color: #a5b4fc;
}

html.dark .field-value.bool,
html.dark .td-cell.bool {
  color: #fbbf24;
}

html.dark .field-value.pk,
html.dark .td-cell.pk {
  color: var(--text-1);
}

html.dark .row-card-head {
  background: rgba(255, 255, 255, 0.04);
}
</style>
