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
                layout="prev, pager, next"
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
                        <span class="th-type">{{ c.type }}</span>
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
                          <button class="json-chip" @click="openJson(c.name, row[c.name])">JSON</button>
                        </template>
                        <template v-else-if="isNull(row[c.name])">
                          <span class="null-val">NULL</span>
                        </template>
                        <template v-else-if="isLong(row[c.name])">
                          <span class="long-val">{{ row[c.name] }}</span>
                        </template>
                        <template v-else>
                          <span class="cell-val">{{ row[c.name] }}</span>
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
                    <span class="row-card-id">{{ row.id || row._id || '' }}</span>
                  </div>
                  <div class="row-card-fields">
                    <div
                      v-for="c in displayCols"
                      :key="c.name"
                      class="row-card-field"
                    >
                      <span class="field-label">{{ c.name }}<template v-if="c.type">&nbsp;<em>{{ c.type }}</em></template></span>
                      <span class="field-value" :class="cellClass(c, row[c.name])">
                        <template v-if="isJson(c, row[c.name])">
                          <button class="json-chip" @click="openJson(c.name, row[c.name])">JSON</button>
                        </template>
                        <template v-else-if="isNull(row[c.name])">
                          <span class="null-val">NULL</span>
                        </template>
                        <template v-else>{{ row[c.name] }}</template>
                      </span>
                    </div>
                  </div>
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
  Coin, Lock, Search, MagicStick, VideoPlay, Loading,
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
  // 直接用 row key 当列：保证表头/卡片字段与实际数据始终对齐，避免 PRAGMA 与 SELECT * 结果不一致导致的"列头在、值全空"空洞表格
  const first = Array.isArray(rows.value) ? rows.value[0] : null;
  if (first) return Object.keys(first).map((name) => ({ name, type: '' }));
  // 加载中或空表，临时回退到列定义（避免列头闪烁）
  return currentMeta.value?.columns || [];
});

/** 主视图标题：优先当前表，SQL 结果显示「SQL 结果」，否则提示选择 */
const viewTitle = computed(() => currentTable.value || (queryResult.value ? 'SQL 结果' : '选择表'));

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
  // 立即清空旧表数据，避免切换时在新表标题下短暂显示上一张表的行
  rows.value = [];
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
    rows.value = [];
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

function cellClass(c: any, v: any) {
  if (isNull(v)) return 'null';
  if (isJson(c, v)) return 'json';
  const t = String(c.type || '').toUpperCase();
  if (t.includes('INT') || t.includes('DECIMAL') || t.includes('REAL') || t.includes('NUM')) return 'num';
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
  margin: 0 auto;
}

/* ========== 头部 ========== */
.db-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
  gap: 10px;
  padding: 12px;
  max-height: 70vh;
  overflow-y: auto;
  overscroll-behavior: contain;
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
  background: rgba(15, 23, 42, 0.025);
  border-bottom: 1px solid var(--border-glass);
  font-size: 11px;
  color: var(--text-3);
}

html.dark .row-card-head {
  background: rgba(255, 255, 255, 0.03);
}

.row-card-index {
  font-weight: 700;
  color: var(--brand-gold);
  font-variant-numeric: tabular-nums;
}

.row-card-id {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
}

.row-card-fields {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.row-card-field {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 12px;
  min-width: 0;
}

.row-card-field + .row-card-field {
  border-top: 1px dashed var(--border-glass);
}

.field-label {
  flex-shrink: 0;
  width: 96px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-label em {
  font-style: normal;
  font-weight: 400;
  opacity: 0.6;
  font-size: 10px;
}

.field-value {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--text-1);
  word-break: break-all;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}

.field-value.num {
  text-align: right;
  color: var(--text-1);
}

/* ========== 数据区 ========== */
.db-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* SQL 查询框 */
.sql-box {
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
  padding: 10px 14px;
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
  font-size: 10px;
  font-weight: 400;
  color: var(--text-3);
  opacity: 0.8;
}

.modern-table tbody td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--border-glass);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: top;
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
  color: var(--brand-cyan);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

.cell-val {
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.long-val {
  color: var(--text-2);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.null-val {
  color: var(--text-3);
  opacity: 0.6;
  font-style: italic;
  font-size: 11px;
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
    max-width: 180px;
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
</style>
