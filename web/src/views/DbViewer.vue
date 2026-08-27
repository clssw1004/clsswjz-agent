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

    <!-- 主体：左列表 + 右内容 -->
    <div class="db-body">
      <!-- 表列表（桌面常驻，移动端可折叠为横向滚动 chips） -->
      <aside class="db-side">
        <div class="side-search">
          <el-input
            v-model="search"
            placeholder="搜索表"
            size="small"
            clearable
            :prefix-icon="Search"
          />
        </div>
        <div class="side-list">
          <button
            v-for="t in filteredTables"
            :key="t.name"
            class="side-item"
            :class="{ on: currentTable === t.name }"
            @click="selectTable(t.name)"
          >
            <el-icon :size="15" class="side-item-icon"><Grid /></el-icon>
            <span class="side-item-name">{{ t.name }}</span>
            <span class="side-item-count">{{ t.count.toLocaleString() }}</span>
          </button>
          <div v-if="!filteredTables.length" class="side-empty">无匹配表</div>
        </div>
      </aside>

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
          <div v-if="queryResult" class="sql-result-meta" :class="{ err: queryError }">
            <template v-if="queryError">
              <el-icon><CircleCloseFilled /></el-icon>{{ queryError }}
            </template>
            <template v-else>
              <el-icon><CircleCheckFilled /></el-icon>
              {{ queryResult.count }} 行
              <template v-if="queryResult.limited"> · 已自动限制 {{ queryResult.pageSize }} 行</template>
              <template v-else> · 未加限制</template>
            </template>
          </div>
        </div>

        <!-- 表数据 -->
        <div class="data-box">
          <div class="data-head">
            <div class="data-title-row">
              <span class="data-title">{{ currentTable || '选择表' }}</span>
              <span v-if="currentMeta" class="data-sub">{{ currentMeta.total.toLocaleString() }} 行 · {{ currentMeta.columns.length }} 列</span>
            </div>
            <div class="data-actions">
              <el-pagination
                v-if="currentMeta && currentMeta.total > pageSize"
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
            <el-empty v-if="!currentTable" description="从左侧选择一张表，或在上方执行 SQL" />
            <el-empty v-else-if="!loading && !rows.length" description="暂无数据" />
            <div v-else-if="rows.length" class="data-scroll">
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
          </div>
        </div>
      </section>
    </div>

    <!-- JSON 详情抽屉 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="jsonVisible" class="json-mask" @click.self="jsonVisible = false">
          <div class="json-sheet">
            <div class="json-head">
              <span class="json-title">{{ jsonTitle }}</span>
              <button class="json-close" @click="jsonVisible = false"><el-icon><Close /></el-icon></button>
            </div>
            <pre class="json-body">{{ jsonContent }}</pre>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  Coin, Lock, Search, Grid, MagicStick, VideoPlay, Loading,
  CircleCheckFilled, CircleCloseFilled, Close,
} from '@element-plus/icons-vue';
import { dbViewerApi } from '@/api';

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

const displayCols = computed(() => currentMeta.value?.columns || []);

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

async function loadData() {
  if (!currentTable.value) return;
  loading.value = true;
  queryResult.value = null;
  queryError.value = '';
  try {
    const res: any = await dbViewerApi.tableData(currentTable.value, {
      page: page.value,
      pageSize: pageSize.value,
    });
    currentMeta.value = res;
    rows.value = Array.isArray(res.rows) ? res.rows : [];
  } catch {
    rows.value = [];
    currentMeta.value = null;
  } finally {
    loading.value = false;
  }
}

async function changePage(p: number) {
  page.value = p;
  await loadData();
}

async function runQuery() {
  const sql = sqlText.value.trim();
  if (!sql || running.value) return;
  running.value = true;
  queryError.value = '';
  try {
    const res: any = await dbViewerApi.query(sql, PAGE_SIZE);
    queryResult.value = res;
    // 查询结果直接作为表格展示（覆盖表数据视图）
    currentMeta.value = {
      table: 'SQL 结果',
      total: res.count,
      columns: (res.columns || []).map((n: string) => ({ name: n, type: '' })),
    };
    rows.value = res.rows || [];
    currentTable.value = '';
  } catch (e: any) {
    queryError.value = e?.response?.data?.message || e?.message || '查询失败';
    queryResult.value = { count: 0, limited: false };
  } finally {
    running.value = false;
  }
}

/* ---------- 单元格渲染辅助 ---------- */
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

watch(search, () => {
  // 搜索时若当前表被过滤掉，不清空选择（列表仍可点击）
});
watch(currentTable, () => {
  if (currentTable.value) {
    // 表格被 SQL 覆盖后，选中表时恢复表数据视图
    loadData();
  }
});

onMounted(loadTables);
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

/* ========== 表列表 ========== */
.db-side {
  width: 240px;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  position: sticky;
  top: 76px;
  max-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.side-search {
  padding: 12px 12px 8px;
}

.side-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 10px;
  overscroll-behavior: contain;
}

.side-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.side-item:hover {
  background: var(--surface-hover);
}

.side-item.on {
  background: var(--brand-gold-soft);
}

.side-item-icon {
  color: var(--text-3);
  flex-shrink: 0;
}

.side-item.on .side-item-icon {
  color: var(--brand-gold-dark);
}

.side-item-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 12px;
}

.side-item-count {
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.side-empty {
  padding: 20px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
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
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.data-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  .db-side {
    position: static;
    width: 100%;
    max-height: none;
  }

  .db-body {
    flex-direction: column;
  }

  .side-list {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 6px;
    padding: 4px 12px 10px;
  }

  .side-item {
    width: auto;
    flex-shrink: 0;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-glass);
    background: var(--surface-active);
  }

  .side-item.on {
    background: var(--brand-gold-soft);
    border-color: rgba(20, 184, 166, 0.3);
  }

  .side-item-name {
    font-size: 12px;
  }

  .side-search {
    display: none;
  }

  .sql-row {
    flex-direction: column;
  }

  .sql-run {
    justify-content: center;
    padding: 10px 0;
  }

  .data-scroll {
    max-height: 60vh;
  }

  .db-meta {
    display: none;
  }
}
</style>
