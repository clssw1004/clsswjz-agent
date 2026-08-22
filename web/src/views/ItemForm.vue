<template>
  <div class="item-form">
    <!-- ── 区块 0：账本选择（仅新增） ── -->
    <section :class="secVisible[0] ? 'sec sec-in' : 'sec'">
      <div v-if="isNew" class="book-picker" @click="bookSheet = true">
        <div class="book-picker-icon"><el-icon :size="18"><Notebook /></el-icon></div>
        <div class="book-picker-info">
          <span class="book-picker-name">{{ currentBookName || '选择账本' }}</span>
          <span class="book-picker-desc">{{ currentBookDesc }}</span>
        </div>
        <el-icon class="book-picker-arrow"><ArrowRight /></el-icon>
      </div>
    </section>

    <!-- ── 区块 1：类型切换（动画 pill，对齐 AnimatedTypeToggle） ── -->
    <section :class="secVisible[1] ? 'sec sec-in' : 'sec'">
      <div class="type-switch">
        <button
          type="button"
          class="type-pill pill-expense"
          :class="{ active: form.type === 'EXPENSE' }"
          @click="setType('EXPENSE')"
        >
          <el-icon :size="18"><Remove /></el-icon>
          <span>支出</span>
        </button>
        <button
          type="button"
          class="type-pill pill-income"
          :class="{ active: form.type === 'INCOME' }"
          @click="setType('INCOME')"
        >
          <el-icon :size="18"><Plus /></el-icon>
          <span>收入</span>
        </button>
      </div>
    </section>

    <!-- ── 区块 2：英雄金额（点击弹计算器） ── -->
    <section :class="secVisible[2] ? 'sec sec-in' : 'sec'">
      <div class="amount-hero" @click="openCalculator">
        <div class="amount-hero-value" :style="{ color: amountColor }">
          <span class="hero-currency">¥</span>
          <span class="hero-number num">{{ displayAmount }}</span>
        </div>
        <div class="amount-hero-hint">点击输入金额</div>
      </div>
    </section>

    <!-- ── 区块 3：基本信息 ── -->
    <section :class="secVisible[3] ? 'sec sec-in' : 'sec'">
      <div class="section-divider">
        <el-icon :size="15"><CollectionTag /></el-icon>
        <span>基本信息</span>
        <i></i>
      </div>

      <div class="field-label">分类 <b class="req">*</b></div>
      <div class="chip-grid">
        <button
          v-for="c in visibleCats"
          :key="c.code"
          type="button"
          class="chip"
          :class="{ on: form.categoryCode === c.code }"
          @click="selectCategory(c)"
        >
          {{ c.name }}
        </button>
        <button type="button" class="chip chip-more" @click="openSheet('category')">更多</button>
        <button type="button" class="chip chip-add" @click="openCreateCat">＋</button>
      </div>

      <div class="field-label">账户 <b class="req">*</b></div>
      <div class="chip-grid">
        <button
          type="button"
          class="chip"
          :class="{ on: !!fundName }"
          @click="openSheet('fund')"
        >
          {{ fundName || '选择账户' }}
        </button>
      </div>

      <div class="field-label">商户</div>
      <div class="chip-grid">
        <button
          type="button"
          class="chip"
          :class="{ on: !!shopName }"
          @click="openSheet('shop')"
        >
          {{ shopName || '选择商户' }}
        </button>
      </div>
    </section>

    <!-- ── 区块 4：详细信息 ── -->
    <section :class="secVisible[4] ? 'sec sec-in' : 'sec'">
      <div class="section-divider">
        <el-icon :size="15"><PriceTag /></el-icon>
        <span>详细信息</span>
        <i></i>
      </div>
      <div class="badge-wrap">
        <span class="badge" :class="{ on: !!tagName }" @click="openSheet('tag')">
          <el-icon :size="14"><PriceTag /></el-icon>
          <span>{{ tagName || '标签' }}</span>
        </span>
        <span class="badge" :class="{ on: !!projectName }" @click="openSheet('project')">
          <el-icon :size="14"><Folder /></el-icon>
          <span>{{ projectName || '项目' }}</span>
        </span>
        <span class="badge" @click="dateSheet = true">
          <el-icon :size="15"><Calendar /></el-icon>
          <span>{{ form.accountDate }}</span>
        </span>
        <span class="badge" @click="timeSheet = true">
          <el-icon :size="15"><Clock /></el-icon>
          <span>{{ form.accountTime || '--:--' }}</span>
        </span>
      </div>
    </section>

    <!-- ── 区块 5：备注 ── -->
    <section :class="secVisible[5] ? 'sec sec-in' : 'sec'">
      <div class="section-divider">
        <el-icon :size="15"><Document /></el-icon>
        <span>备注</span>
        <i></i>
      </div>
      <el-input
        v-model="form.description"
        type="textarea"
        :rows="3"
        placeholder="请输入备注（可选）"
        @input="scheduleAutoSave"
      />

      <!-- 附件（对齐移动端 CommonAttachmentField；仅编辑模式，上传依赖账目 ID） -->
      <div v-if="!isNew" class="attach-area">
        <div class="attach-title">附件</div>
        <div v-if="attachments.length" class="attach-list">
          <div v-for="a in attachments" :key="a.id" class="attach-item">
            <el-icon :size="15"><Document /></el-icon>
            <span class="attach-name" :title="a.originName">{{ a.originName }}</span>
            <span class="attach-size">{{ fmtSize(a.fileLength) }}</span>
            <el-icon class="attach-del" @click="removeAttachment(a)"><Close /></el-icon>
          </div>
        </div>
        <label class="attach-add">
          <el-icon :size="15"><UploadFilled /></el-icon>
          <span>添加附件</span>
          <input type="file" hidden @change="uploadAttachment($event)" />
        </label>
      </div>
    </section>

    <!-- ── 区块 6：操作 ── -->
    <section :class="secVisible[6] ? 'sec sec-in' : 'sec'">
      <el-button v-if="isNew" type="primary" class="save-btn" :loading="saving" @click="onSave">
        保存
      </el-button>
      <template v-else>
        <div class="autosave-bar">
          <span class="autosave-hint">{{ saveHint }}</span>
          <el-button class="delete-btn" @click="onDelete">删除</el-button>
        </div>
      </template>
    </section>

    <!-- ══════════ 底部弹层 ══════════ -->

    <!-- 账本选择 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="bookSheet" class="sheet-mask" @click.self="bookSheet = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">选择账本</div>
            <div class="sheet-list">
              <div
                v-for="b in app.books"
                :key="b.id"
                class="sheet-item"
                :class="{ sel: b.id === app.currentBookId }"
                @click="pickBook(b)"
              >
                <el-icon :size="18"><Notebook /></el-icon>
                <span class="sheet-item-name">{{ b.name }}</span>
                <el-icon v-if="b.id === app.currentBookId" :size="18" class="sheet-check"><CircleCheckFilled /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 单选列表弹层（分类更多 / 账户 / 商户 / 标签 / 项目） -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="sheetData && sheetVisible" class="sheet-mask" @click.self="sheetVisible = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">{{ sheetData.title }}</div>
            <div class="sheet-list">
              <div
                v-for="opt in sheetData.options"
                :key="opt.value"
                class="sheet-item"
                :class="{ sel: opt.value === sheetData.selected }"
                @click="pickOption(opt)"
              >
                <span class="sheet-item-name">{{ opt.label }}</span>
                <el-icon v-if="opt.value === sheetData.selected" :size="18" class="sheet-check"><CircleCheckFilled /></el-icon>
              </div>
              <div v-if="!sheetData.options.length" class="sheet-empty">暂无数据</div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 日期选择 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="dateSheet" class="sheet-mask" @click.self="dateSheet = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">选择日期</div>
            <el-date-picker
              v-model="dateValue"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              class="sheet-date-picker"
              @change="pickDate"
            />
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 时间选择 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="timeSheet" class="sheet-mask" @click.self="timeSheet = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">选择时间</div>
            <el-time-picker
              v-model="timeValue"
              format="HH:mm"
              value-format="HH:mm"
              class="sheet-time-picker"
              @change="pickTime"
            />
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 新建分类 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="createCatVisible" class="sheet-mask" @click.self="createCatVisible = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">新建{{ form.type === 'INCOME' ? '收入' : '支出' }}分类</div>
            <div class="sheet-form">
              <el-input v-model="newCat.name" placeholder="分类名称" size="large" />
              <el-input v-model="newCat.code" placeholder="编码（留空自动生成）" size="large" />
              <el-button type="primary" class="sheet-confirm" :loading="creatingCat" @click="submitCreateCat">
                创建
              </el-button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ══════════ 金额计算器（对齐 CalculatorPanel） ══════════ -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="calcVisible" class="sheet-mask" @click.self="closeCalc">
          <div class="sheet calc-sheet">
            <!-- 显示区 -->
            <div class="calc-display">
              <span class="calc-yen">¥</span>
              <span class="calc-text num">{{ calcDisplay || '0' }}</span>
            </div>
            <div class="calc-grid">
              <button type="button" class="calc-key key-op" @click="calcClear">C</button>
              <button type="button" class="calc-key key-op" @click="calcAddOperator('/')">÷</button>
              <button type="button" class="calc-key key-op" @click="calcAddOperator('*')">×</button>
              <button type="button" class="calc-key key-op" @click="calcBackspace">⌫</button>

              <button type="button" class="calc-key" @click="calcAddNumber('7')">7</button>
              <button type="button" class="calc-key" @click="calcAddNumber('8')">8</button>
              <button type="button" class="calc-key" @click="calcAddNumber('9')">9</button>
              <button type="button" class="calc-key key-op" @click="calcAddOperator('-')">−</button>

              <button type="button" class="calc-key" @click="calcAddNumber('4')">4</button>
              <button type="button" class="calc-key" @click="calcAddNumber('5')">5</button>
              <button type="button" class="calc-key" @click="calcAddNumber('6')">6</button>
              <button type="button" class="calc-key key-op" @click="calcAddOperator('+')">+</button>

              <button type="button" class="calc-key" @click="calcAddNumber('1')">1</button>
              <button type="button" class="calc-key" @click="calcAddNumber('2')">2</button>
              <button type="button" class="calc-key" @click="calcAddNumber('3')">3</button>
              <div class="calc-key calc-empty"></div>

              <button type="button" class="calc-key key-zero" @click="calcAddNumber('0')">0</button>
              <button type="button" class="calc-key" @click="calcAddNumber('.')">.</button>
              <div class="calc-key calc-empty"></div>

              <button
                type="button"
                class="calc-key key-ok"
                @click="calcConfirm"
              >
                {{ calcNeedEquals ? '=' : 'OK' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Remove, Plus, Notebook, ArrowRight, PriceTag, Folder,
  Calendar, Clock, Document, Close, UploadFilled, CircleCheckFilled, CollectionTag,
} from '@element-plus/icons-vue';
import type { FormInstance } from 'element-plus';
import {
  itemApi, categoryApi, fundApi, shopApi, tagApi, projectApi, attachmentApi,
} from '@/api';
import { useAppStore } from '@/stores/app';

const route = useRoute();
const router = useRouter();
const app = useAppStore();

const itemId = route.params.id ? String(route.params.id) : '';
const isNew = computed(() => !itemId);

/* ────────────── 错落入场动画 ────────────── */
const secVisible = ref<boolean[]>([false, false, false, false, false, false, false]);
onMounted(() => {
  for (let i = 0; i < secVisible.value.length; i++) {
    setTimeout(() => { secVisible.value[i] = true; }, 80 * i);
  }
});

/* ────────────── 表单状态 ────────────── */
const saving = ref(false);
const lastSavedAt = ref<number | null>(null);
let saveTimer: any = null;

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const form = reactive({
  type: 'EXPENSE' as 'EXPENSE' | 'INCOME',
  amount: undefined as number | undefined,
  categoryCode: '',
  fundId: '',
  shopCode: '',
  tagCode: '',
  projectCode: '',
  accountDate: today(),
  accountTime: '', // "HH:mm"，空表示纯日期
  description: '',
});

const categories = ref<any[]>([]);
const funds = ref<any[]>([]);
const shops = ref<any[]>([]);
const tags = ref<any[]>([]);
const projects = ref<any[]>([]);
const attachments = ref<any[]>([]);

const filteredCategories = computed(() =>
  categories.value.filter((c) => c.categoryType === form.type)
);
const visibleCats = computed(() => filteredCategories.value.slice(0, 8));

const amountColor = computed(() =>
  form.type === 'INCOME' ? 'var(--amount-income)' : 'var(--amount-expense)'
);
const displayAmount = computed(() =>
  form.amount === undefined || form.amount === null ? '0.00' : String(form.amount)
);
const currentBookName = computed(
  () => app.books.find((b: any) => b.id === app.currentBookId)?.name || ''
);
const currentBookDesc = computed(
  () => app.books.find((b: any) => b.id === app.currentBookId)?.description || ''
);
const fundName = computed(() => funds.value.find((f) => f.id === form.fundId)?.name || '');
const shopName = computed(() => shops.value.find((s) => s.code === form.shopCode)?.name || '');
const tagName = computed(() => tags.value.find((t) => t.code === form.tagCode)?.name || '');
const projectName = computed(() => projects.value.find((p) => p.code === form.projectCode)?.name || '');

const saveHint = computed(() => {
  if (saving.value) return '保存中…';
  if (lastSavedAt.value) return `已自动保存 ${new Date(lastSavedAt.value).toLocaleTimeString('zh-CN', { hour12: false })}`;
  return '修改自动保存';
});

/* ────────────── 数据加载 ────────────── */
async function loadOptions() {
  const bookId = app.currentBookId;
  const [cats, fnds, shps, tgs, prjs] = await Promise.all([
    categoryApi.list(bookId ? { accountBookId: bookId } : {}),
    fundApi.list(bookId ? { accountBookId: bookId } : {}),
    shopApi.list(bookId ? { accountBookId: bookId } : {}),
    tagApi.list(bookId ? { accountBookId: bookId } : {}),
    projectApi.list(bookId ? { accountBookId: bookId } : {}),
  ]);
  categories.value = cats.items || cats || [];
  funds.value = fnds.items || fnds || [];
  shops.value = shps.items || shps || [];
  tags.value = tgs.items || tgs || [];
  projects.value = prjs.items || prjs || [];
}

async function loadAttachments() {
  if (!itemId) return;
  try {
    const res: any = await attachmentApi.list({ businessCode: 'item', businessId: itemId });
    attachments.value = Array.isArray(res) ? res : res?.items || [];
  } catch { /* 附件可选 */ }
}

onMounted(async () => {
  try {
    await loadOptions();
  } catch { /* options are optional */ }

  if (itemId) {
    const res: any = await itemApi.get(itemId);
    const it = res.items || res;
    form.type = it.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    form.amount = Math.abs(Number(it.amount));
    form.categoryCode = it.categoryCode || '';
    form.fundId = it.fundId ?? '';
    form.shopCode = it.shopCode || '';
    form.tagCode = it.tagCode || '';
    form.projectCode = it.projectCode || '';
    // 日期与时间分离（兼容纯日期 / "YYYY-MM-DD HH:mm" 两种存储）
    const dstr = String(it.accountDate || '');
    form.accountDate = dstr.slice(0, 10) || today();
    form.accountTime = dstr.length > 10 ? dstr.slice(11, 16) : '';
    form.description = it.description || '';
    await loadAttachments();
  }
});

// 全局账本切换时重载下拉选项
watch(() => app.currentBookId, async () => {
  try {
    await loadOptions();
  } catch { /* options are optional */ }
});

/* ────────────── 类型切换（对齐移动端：金额符号随类型反转，但 web 存正数，无需转换） ────────────── */
function setType(t: 'EXPENSE' | 'INCOME') {
  if (form.type === t) return;
  form.type = t;
  // 分类可能不属于新类型，清空
  if (form.categoryCode && !filteredCategories.value.some((c) => c.code === form.categoryCode)) {
    form.categoryCode = '';
  }
  scheduleAutoSave();
}

/* ────────────── 计算器（对齐 CalculatorPanel） ────────────── */
const calcVisible = ref(false);
const calcExpr = ref('');
const calcDisplay = ref('');
const calcHasOperator = ref(false);
const calcIsCalculated = ref(false);

const calcNeedEquals = computed(() => calcHasOperator.value && !/[+\-*/]$/.test(calcExpr.value));

function openCalculator() {
  calcVisible.value = true;
  if (form.amount !== undefined && form.amount !== null) {
    calcExpr.value = String(form.amount);
    calcDisplay.value = String(form.amount);
    calcHasOperator.value = false;
    calcIsCalculated.value = true;
  } else {
    calcExpr.value = '';
    calcDisplay.value = '';
    calcHasOperator.value = false;
    calcIsCalculated.value = false;
  }
}

function closeCalc() {
  calcVisible.value = false;
}

function calcAddNumber(num: string) {
  if (calcIsCalculated.value) {
    calcExpr.value = '';
    calcDisplay.value = '';
    calcIsCalculated.value = false;
  }
  if (num === '.') {
    const parts = calcExpr.value.split(/[+\-*/]/);
    const current = parts.length ? parts[parts.length - 1] : '';
    if (current.includes('.')) return;
    if (endsWithOperator(calcExpr.value)) {
      calcExpr.value += '0.';
      calcDisplay.value = calcExpr.value;
      return;
    }
  }
  calcExpr.value += num;
  calcDisplay.value = calcExpr.value;
}

function endsWithOperator(v: string) {
  return /[+\-*/]$/.test(v);
}

function calcAddOperator(op: string) {
  if (!calcExpr.value) {
    if (op === '-') {
      calcExpr.value = op;
      calcDisplay.value = op;
    }
    return;
  }
  if (calcExpr.value === '-') return;
  if (calcHasOperator.value) {
    if (endsWithOperator(calcExpr.value)) {
      calcExpr.value = calcExpr.value.slice(0, -1) + op;
      calcDisplay.value = calcExpr.value;
      return;
    }
    calcCalculate();
  }
  calcExpr.value += op;
  calcDisplay.value = calcExpr.value;
  calcHasOperator.value = true;
  calcIsCalculated.value = false;
}

function calcCalculate() {
  if (!calcHasOperator.value || endsWithOperator(calcExpr.value)) return;
  const m = calcExpr.value.match(/^(-?\d*\.?\d+)([+\-*/])(-?\d*\.?\d+)$/);
  if (!m) return;
  const a = parseFloat(m[1]);
  const op = m[2];
  const b = parseFloat(m[3]);
  let result = 0;
  switch (op) {
    case '+': result = a + b; break;
    case '-': result = a - b; break;
    case '*': result = a * b; break;
    case '/':
      if (b === 0) {
        calcDisplay.value = '错误';
        calcExpr.value = '';
        calcHasOperator.value = false;
        calcIsCalculated.value = true;
        return;
      }
      result = a / b;
      break;
  }
  const formatted = result.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  calcExpr.value = formatted;
  calcDisplay.value = formatted;
  calcHasOperator.value = false;
  calcIsCalculated.value = true;
}

function calcBackspace() {
  if (!calcExpr.value) return;
  if (endsWithOperator(calcExpr.value)) calcHasOperator.value = false;
  calcExpr.value = calcExpr.value.slice(0, -1);
  calcDisplay.value = calcExpr.value;
  calcIsCalculated.value = false;
}

function calcClear() {
  calcExpr.value = '';
  calcDisplay.value = '';
  calcHasOperator.value = false;
  calcIsCalculated.value = false;
}

function calcConfirm() {
  if (calcHasOperator.value && !endsWithOperator(calcExpr.value)) {
    calcCalculate();
    return;
  }
  if (!calcDisplay.value || calcDisplay.value === '错误' || endsWithOperator(calcExpr.value)) return;
  const v = parseFloat(calcDisplay.value);
  if (Number.isNaN(v)) return;
  form.amount = v;
  calcVisible.value = false;
  scheduleAutoSave();
}

/* ────────────── 底部弹层（单选列表） ────────────── */
type SheetKind = 'category' | 'fund' | 'shop' | 'tag' | 'project' | null;
const sheetVisible = ref(false);
const sheetData = ref<{ title: string; options: { label: string; value: string }[]; selected: string; kind: SheetKind } | null>(null);

function openSheet(kind: Exclude<SheetKind, null>) {
  let title = '';
  let options: { label: string; value: string }[] = [];
  let selected = '';
  switch (kind) {
    case 'category':
      title = '选择分类';
      options = filteredCategories.value.map((c) => ({ label: c.name, value: c.code }));
      selected = form.categoryCode;
      break;
    case 'fund':
      title = '选择账户';
      options = funds.value.map((f) => ({ label: f.name, value: f.id }));
      selected = form.fundId || '';
      break;
    case 'shop':
      title = '选择商户';
      options = shops.value.map((s) => ({ label: s.name, value: s.code }));
      selected = form.shopCode || '';
      break;
    case 'tag':
      title = '选择标签';
      options = tags.value.map((t) => ({ label: t.name, value: t.code }));
      selected = form.tagCode || '';
      break;
    case 'project':
      title = '选择项目';
      options = projects.value.map((p) => ({ label: p.name, value: p.code }));
      selected = form.projectCode || '';
      break;
  }
  sheetData.value = { title, options, selected, kind };
  sheetVisible.value = true;
}

function pickOption(opt: { label: string; value: string }) {
  if (!sheetData.value) return;
  const kind = sheetData.value.kind;
  if (kind === 'category') form.categoryCode = opt.value;
  else if (kind === 'fund') form.fundId = opt.value;
  else if (kind === 'shop') form.shopCode = opt.value;
  else if (kind === 'tag') form.tagCode = opt.value;
  else if (kind === 'project') form.projectCode = opt.value;
  sheetVisible.value = false;
  scheduleAutoSave();
}

function selectCategory(c: any) {
  form.categoryCode = c.code;
  scheduleAutoSave();
}

/* ────────────── 账本选择 ────────────── */
const bookSheet = ref(false);
function pickBook(b: any) {
  app.switchBook(b.id);
  bookSheet.value = false;
  loadOptions();
}

/* ────────────── 日期 / 时间 ────────────── */
const dateSheet = ref(false);
const dateValue = ref(form.accountDate);
function pickDate(v: string) {
  if (v) {
    form.accountDate = v;
    scheduleAutoSave();
  }
  dateSheet.value = false;
}

const timeSheet = ref(false);
const timeValue = ref('');
function pickTime(v: string) {
  if (v) {
    form.accountTime = v;
    scheduleAutoSave();
  }
  timeSheet.value = false;
}

/* ────────────── 新建分类 ────────────── */
const createCatVisible = ref(false);
const creatingCat = ref(false);
const newCat = reactive({ name: '', code: '' });
function openCreateCat() {
  newCat.name = '';
  newCat.code = '';
  createCatVisible.value = true;
}
async function submitCreateCat() {
  if (!newCat.name.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  creatingCat.value = true;
  try {
    const res: any = await categoryApi.create({
      name: newCat.name.trim(),
      code: newCat.code.trim() || `c${Date.now()}`,
      categoryType: form.type,
      accountBookId: app.currentBookId,
    });
    await loadOptions();
    form.categoryCode = res?.code || res?.id || '';
    createCatVisible.value = false;
    ElMessage.success('分类已创建');
  } catch { /* 错误已由拦截器提示 */ } finally {
    creatingCat.value = false;
  }
}

/* ────────────── 附件 ────────────── */
function fmtSize(bytes?: number) {
  const n = Number(bytes ?? 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
async function uploadAttachment(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await attachmentApi.upload(file, 'item', itemId);
    ElMessage.success('附件已上传');
    await loadAttachments();
  } catch { /* 错误已提示 */ }
  input.value = '';
}
async function removeAttachment(a: any) {
  await ElMessageBox.confirm(`确定删除附件「${a.originName}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  });
  await attachmentApi.remove(a.id);
  ElMessage.success('已删除');
  await loadAttachments();
}

/* ────────────── 保存（新增手动 / 编辑自动，对齐移动端 autoSave） ────────────── */
function buildPayload() {
  const amount = Number(form.amount) || 0;
  let accountDate = form.accountDate;
  if (form.accountTime) accountDate = `${form.accountDate} ${form.accountTime}`;
  return {
    type: form.type,
    amount: form.type === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount),
    categoryCode: form.categoryCode || null,
    fundId: form.fundId || null,
    shopCode: form.shopCode || null,
    tagCode: form.tagCode || null,
    projectCode: form.projectCode || null,
    accountDate,
    description: form.description || '',
  };
}

function scheduleAutoSave() {
  if (isNew.value) return; // 新增模式手动保存
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => doSave(), 500);
}

async function doSave() {
  if (!itemId) return;
  saving.value = true;
  try {
    await itemApi.update(itemId, buildPayload());
    lastSavedAt.value = Date.now();
  } catch { /* 错误已由拦截器提示 */ } finally {
    saving.value = false;
  }
}

async function onSave() {
  if (!form.amount || Number(form.amount) <= 0) {
    ElMessage.warning('请输入金额');
    return;
  }
  if (!form.categoryCode) {
    ElMessage.warning('请选择分类');
    return;
  }
  saving.value = true;
  try {
    await itemApi.create({ ...buildPayload(), accountBookId: app.currentBookId });
    ElMessage.success('已添加');
    router.back();
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  try {
    await ElMessageBox.confirm('确定删除这条记录吗？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  saving.value = true;
  try {
    await itemApi.delete(itemId);
    ElMessage.success('已删除');
    router.back();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.item-form {
  max-width: 560px;
  margin: 0 auto;
  padding-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sec {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.35s ease-out, transform 0.35s ease-out;
}

.sec.sec-in {
  opacity: 1;
  transform: none;
}

/* ========== 区块 0：账本选择 ========== */
.book-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass-strong);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: background 0.15s ease;
}

.book-picker:active {
  background: var(--surface-hover);
}

.book-picker-icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  color: #fff;
  background: var(--grad-brand);
}

.book-picker-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.book-picker-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.book-picker-desc {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-picker-arrow {
  color: var(--text-3);
}

/* ========== 区块 1：类型切换（动画 pill） ========== */
.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-card);
}

.type-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 46px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: var(--text-3);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s ease, color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
}

.type-pill.active {
  color: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  transform: scale(1.04);
}

.pill-expense.active {
  background: linear-gradient(135deg, #c05c4a, var(--amount-expense));
}

.pill-income.active {
  background: linear-gradient(135deg, #4caf50, var(--amount-income));
}

/* ========== 区块 2：英雄金额 ========== */
.amount-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 16px 26px;
  border-radius: var(--radius-md);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: background 0.15s ease;
}

.amount-hero:active {
  background: var(--surface-hover);
}

.amount-hero-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.hero-currency {
  font-size: 26px;
  font-weight: 600;
}

.hero-number {
  font-size: 44px;
  font-weight: 700;
  line-height: 1.1;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount-hero-hint {
  font-size: 12px;
  color: var(--text-3);
}

/* ========== 分割线标题 ========== */
.section-divider {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
  color: var(--brand-gold);
  font-size: 12px;
  font-weight: 600;
}

.section-divider i {
  flex: 1;
  height: 1px;
  background: var(--border-glass);
}

/* 分割线后首个字段 label 顶部间距收敛，避免叠加 */
.sec .field-label:first-of-type {
  margin-top: 2px;
}

/* ========== 表单字段 ========== */
.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin: 14px 0 8px;
}

.field-label .req {
  color: var(--brand-red);
  font-weight: 700;
}

/* ========== 分类 / 单选胶囊（基本信息统一形态） ========== */
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  height: 34px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--border-glass);
  background: var(--surface-glass-strong);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.chip:hover {
  border-color: var(--border-glass-strong);
}

.chip.on {
  background: var(--grad-brand);
  border-color: transparent;
  color: var(--on-primary);
  font-weight: 600;
  box-shadow: var(--glow-primary);
}

.chip-more {
  color: var(--brand-gold);
  border-style: dashed;
}

.chip-add {
  color: var(--text-3);
  border-style: dashed;
  font-size: 15px;
  padding: 0 12px;
}

/* ========== 徽标（详细信息，保留图标，高度与胶囊统一） ========== */
.badge-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  height: 34px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  border: 1px solid var(--border-glass-strong);
  background: var(--surface-glass-strong);
  color: var(--text-3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.badge:hover {
  border-color: var(--brand-gold);
}

.badge.on {
  border-color: var(--brand-gold);
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
  font-weight: 600;
}

/* ========== 备注 / 附件 ========== */
.attach-area {
  margin-top: 16px;
}

.attach-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
}

.attach-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.attach-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  font-size: 13px;
  color: var(--text-2);
}

.attach-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attach-size {
  font-size: 11px;
  color: var(--text-3);
}

.attach-del {
  cursor: pointer;
  color: var(--text-3);
}

.attach-del:hover {
  color: var(--brand-red);
}

.attach-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px dashed var(--border-glass-strong);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.attach-add:hover {
  color: var(--brand-gold);
  border-color: var(--brand-gold);
}

/* ========== 操作 ========== */
.save-btn {
  width: 100%;
  height: 50px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 14px;
  border: none;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
}

.autosave-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.autosave-hint {
  font-size: 12px;
  color: var(--text-3);
}

.delete-btn {
  color: var(--brand-red);
  border-color: rgba(239, 68, 68, 0.4);
  border-radius: 999px;
}

/* ========== 底部弹层 ========== */
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(4, 8, 18, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 480px;
  max-height: 76vh;
  overflow-y: auto;
  background: var(--surface-glass-strong);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: 20px 20px 0 0;
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-pop);
}

.sheet-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-3);
  opacity: 0.4;
  margin: 4px auto 14px;
}

.sheet-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 12px;
}

.sheet-list {
  display: flex;
  flex-direction: column;
}

.sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 12px;
  border-radius: var(--radius-md);
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s ease;
}

.sheet-item:active {
  background: var(--surface-hover);
}

.sheet-item.sel {
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
}

.sheet-item-name {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
}

.sheet-item.sel .sheet-item-name {
  font-weight: 700;
}

.sheet-check {
  color: var(--brand-gold);
}

.sheet-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}

.sheet-date-picker,
.sheet-time-picker {
  width: 100%;
}

.sheet-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sheet-form .sheet-confirm {
  margin-top: 6px;
  border: none;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
}

/* ========== 计算器 ========== */
.calc-sheet {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.calc-display {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 16px 16px;
}

.calc-yen {
  font-size: 26px;
  font-weight: 500;
  color: var(--brand-gold);
}

.calc-text {
  flex: 1;
  font-size: 36px;
  font-weight: 400;
  color: var(--text-1);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 54px;
  gap: 8px;
}

.calc-key {
  border: none;
  border-radius: 14px;
  background: var(--surface-hover);
  color: var(--text-1);
  font-size: 22px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calc-key:active {
  background: var(--surface-active);
  transform: scale(0.96);
}

.calc-key.key-op {
  background: rgba(15, 23, 42, 0.05);
  color: var(--brand-gold);
  font-size: 24px;
}

html.dark .calc-key.key-op {
  background: rgba(255, 255, 255, 0.08);
}

.key-zero {
  grid-column: span 2;
}

.calc-empty {
  pointer-events: none;
  background: transparent;
}

.key-ok {
  grid-column: 4;
  grid-row: 4 / 6;
  background: var(--grad-brand);
  color: var(--on-primary);
  font-size: 22px;
  font-weight: 600;
  box-shadow: var(--glow-primary);
}

/* 弹层过渡 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}

@media (max-width: 767px) {
  .item-form {
    padding-bottom: 20px;
  }

  .hero-number {
    font-size: 38px;
  }
}

/* 桌面端：表单稍宽、英雄金额收敛，避免移动端放大感 */
@media (min-width: 768px) {
  .item-form {
    max-width: 680px;
  }

  .hero-number {
    font-size: 36px;
  }

  .amount-hero {
    padding: 22px 16px 20px;
  }

  .type-pill {
    height: 52px;
  }
}
</style>
