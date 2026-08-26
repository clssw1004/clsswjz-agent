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
        <span class="badge" :class="{ on: form.tagCodes.length > 1 }" @click="openTagSheet">
          <el-icon :size="14"><PriceTag /></el-icon>
          <span>{{ tagDisplay }}</span>
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
          <div
            v-for="a in attachments"
            :key="a.id"
            class="attach-item"
            :title="downloadingIds.has(a.id) ? '下载中…' : a.originName"
            @click="openAttachment(a)"
          >
            <el-icon :size="15"><Document /></el-icon>
            <span class="attach-name">{{ a.originName }}</span>
            <span class="attach-size">{{ fmtSize(a.fileLength) }}</span>
            <el-icon v-if="downloadingIds.has(a.id)" class="is-loading attach-dl"><Loading /></el-icon>
            <el-icon v-else class="attach-del" @click.stop="removeAttachment(a)"><Close /></el-icon>
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

    <!-- 单选列表弹层（分类更多 / 账户 / 商户 / 项目：支持搜索与创建） -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="sheetData && sheetVisible" class="sheet-mask" @click.self="sheetVisible = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">{{ sheetData.title }}</div>
            <div v-if="sheetData.options.length > 6 || sheetData.allowCreate" class="sheet-search">
              <el-input
                v-model="sheetSearch"
                placeholder="搜索或输入新建名称"
                size="large"
                clearable
                :prefix-icon="Search"
              />
            </div>
            <div class="sheet-list">
              <div
                v-for="opt in filteredSheetOptions"
                :key="opt.value"
                class="sheet-item"
                :class="{ sel: opt.value === sheetData.selected }"
                @click="pickOption(opt)"
              >
                <span class="sheet-item-name">{{ opt.label }}</span>
                <el-icon v-if="opt.value === sheetData.selected" :size="18" class="sheet-check"><CircleCheckFilled /></el-icon>
              </div>
              <div v-if="!filteredSheetOptions.length && !(sheetData.allowCreate && sheetSearch.trim())" class="sheet-empty">暂无数据</div>
              <div
                v-if="sheetData.allowCreate && sheetSearch.trim() && !filteredSheetOptions.some((o) => o.label.toLowerCase() === sheetSearch.trim().toLowerCase())"
                class="sheet-item sheet-create"
                @click="createSheetOption"
              >
                <el-icon :size="18" class="sheet-check"><Plus /></el-icon>
                <span class="sheet-item-name">创建「{{ sheetSearch.trim() }}」</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 树形选择弹层（分类 / 商户，对齐移动端 TreeSelectSheet：parentId 层级 + 展开收起 + 最近使用排序） -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="treeSheetVisible" class="sheet-mask" @click.self="treeSheetVisible = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">{{ treeData?.title }}</div>
            <div class="sheet-search">
              <el-input
                v-model="treeSearch"
                placeholder="搜索或输入新建名称"
                size="large"
                clearable
                :prefix-icon="Search"
              />
            </div>
            <!-- 视图切换（对齐移动端 TreeSelectSheet：智能推荐 / 最近使用 / 树形视图） -->
            <div v-if="treeHasScore || treeHasRecent" class="tree-tabs">
              <button
                v-if="treeHasScore"
                type="button"
                class="tree-tab"
                :class="{ on: treeData?.viewMode === 'recommend' }"
                @click="setTreeView('recommend')"
              >
                <el-icon :size="14"><MagicStick /></el-icon>
                <span>智能推荐</span>
              </button>
              <button
                v-if="treeHasRecent"
                type="button"
                class="tree-tab"
                :class="{ on: treeData?.viewMode === 'recent' }"
                @click="setTreeView('recent')"
              >
                <el-icon :size="14"><Clock /></el-icon>
                <span>最近使用</span>
              </button>
              <button
                type="button"
                class="tree-tab"
                :class="{ on: treeData?.viewMode === 'tree' }"
                @click="setTreeView('tree')"
              >
                <el-icon :size="14"><FolderOpened /></el-icon>
                <span>树形视图</span>
              </button>
              <span v-if="treeLoadingScores" class="tree-tab-loading">评分中…</span>
            </div>
            <div class="sheet-list">
              <template v-for="row in visibleTreeRows" :key="row.node.code">
                <div
                  class="sheet-item"
                  :class="{ sel: row.node.code === treeData?.selected }"
                  :style="{ paddingLeft: 12 + row.level * 18 + 'px' }"
                  @click="pickTreeNode(row.node)"
                >
                  <span v-if="hasTreeChildren(row.node)" class="tree-arrow" @click.stop="toggleTreeExpand(row.node)">
                    <el-icon :size="14"><ArrowDown v-if="isTreeExpanded(row.node)" /><ArrowRight v-else /></el-icon>
                  </span>
                  <span v-else class="tree-arrow tree-dot"></span>
                  <span class="sheet-item-name">{{ row.node.name }}</span>
                  <el-icon v-if="row.node.code === treeData?.selected" :size="18" class="sheet-check"><CircleCheckFilled /></el-icon>
                </div>
              </template>
              <div v-if="!visibleTreeRows.length && !(treeData?.allowCreate && treeSearch.trim())" class="sheet-empty">暂无数据</div>
              <div
                v-if="treeData?.allowCreate && treeSearch.trim() && !visibleTreeRows.some((r) => r.node.name.toLowerCase() === treeSearch.trim().toLowerCase())"
                class="sheet-item sheet-create"
                @click="createTreeOption"
              >
                <el-icon :size="18" class="sheet-check"><Plus /></el-icon>
                <span class="sheet-item-name">创建「{{ treeSearch.trim() }}」</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 标签多选弹层（对齐移动端 MultiSelectSheet） -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="tagSheetVisible" class="sheet-mask" @click.self="tagSheetVisible = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">选择标签</div>
            <div class="sheet-search">
              <el-input
                v-model="tagSheetSearch"
                placeholder="搜索或输入新建标签"
                size="large"
                clearable
                :prefix-icon="Search"
              />
            </div>
            <div class="sheet-list">
              <div
                v-for="t in filteredTags"
                :key="t.code"
                class="sheet-item"
                :class="{ sel: tagSelected.includes(t.code) }"
                @click="toggleTag(t.code)"
              >
                <span class="sheet-item-name">{{ t.name }}</span>
                <el-icon v-if="tagSelected.includes(t.code)" :size="18" class="sheet-check"><CircleCheckFilled /></el-icon>
              </div>
              <div v-if="!filteredTags.length && !showCreateTag" class="sheet-empty">暂无数据</div>
              <div v-if="showCreateTag" class="sheet-item sheet-create" :class="{ loading: creatingTag }" @click="createTag">
                <el-icon :size="18" class="sheet-check"><Plus /></el-icon>
                <span class="sheet-item-name">创建「{{ tagSheetSearch.trim() }}」</span>
              </div>
            </div>
            <el-button type="primary" class="sheet-confirm" @click="confirmTags">确定（{{ tagSelected.length }}）</el-button>
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
  Remove, Plus, Notebook, ArrowRight, ArrowDown, PriceTag, Folder, FolderOpened,
  Calendar, Clock, Document, Close, UploadFilled, CircleCheckFilled, CollectionTag, Search, MagicStick, Loading,
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
  tagCodes: [] as string[],
  projectCode: '',
  accountDate: today(),
  accountTime: nowTime(), // "HH:mm"，新增默认当前时间（对齐移动端）
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
// 对齐移动端 expand 模式：按最近使用时间倒序取前 8，选中项不在前 8 时保底替换进展示区
const visibleCats = computed(() => {
  const cats = [...filteredCategories.value].sort((a, b) => {
    const ta = a.lastAccountItemAt ? new Date(a.lastAccountItemAt).getTime() : 0;
    const tb = b.lastAccountItemAt ? new Date(b.lastAccountItemAt).getTime() : 0;
    return tb - ta;
  });
  const list = cats.slice(0, 8);
  if (form.categoryCode && !list.some((c) => c.code === form.categoryCode)) {
    const sel = cats.find((c) => c.code === form.categoryCode);
    if (sel) {
      if (list.length >= 8) list[7] = sel;
      else list.push(sel);
    }
  }
  return list;
});

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
// 标签多选显示（对齐移动端 _TagBadge）：未选「标签」/ 1 个显名称 / 多个显「N 个标签」
const tagDisplay = computed(() => {
  if (!form.tagCodes.length) return '标签';
  if (form.tagCodes.length === 1) {
    return tags.value.find((t) => t.code === form.tagCodes[0])?.name || form.tagCodes[0];
  }
  return `${form.tagCodes.length} 个标签`;
});
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
  pickDefaultFund();

  if (itemId) {
    const res: any = await itemApi.get(itemId);
    const it = res.items || res;
    form.type = it.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    form.amount = Math.abs(Number(it.amount));
    form.categoryCode = it.categoryCode || '';
    form.fundId = it.fundId ?? '';
    form.shopCode = it.shopCode || '';
    // 多标签优先取 tags（item_rel_field 关联表），兼容历史 tagCode 单值
    form.tagCodes = Array.isArray(it.tags) && it.tags.length
      ? it.tags
      : (it.tagCode ? [it.tagCode] : []);
    form.projectCode = it.projectCode || '';
    // 日期与时间分离（兼容纯日期 / "YYYY-MM-DD HH:mm" 两种存储）
    const dstr = String(it.accountDate || '');
    form.accountDate = dstr.slice(0, 10) || today();
    form.accountTime = dstr.length > 10 ? dstr.slice(11, 16) : '';
    form.description = it.description || '';
    await loadAttachments();
  }
});

// 全局账本切换时重载下拉选项，并重置默认账户（对齐移动端 changeBook 重置 defaultFundId）
watch(() => app.currentBookId, async () => {
  try {
    await loadOptions();
  } catch { /* options are optional */ }
  pickDefaultFund();
});

// 默认账户：账本 defaultFundId → isDefault 标志 → 第一个账户（对齐移动端 ItemFormProvider）
function pickDefaultFund() {
  if (form.fundId && funds.value.some((f) => f.id === form.fundId)) return;
  const book: any = app.currentBook;
  const byBookDefault = funds.value.find((f) => book?.defaultFundId && f.id === book.defaultFundId);
  const byFlag = funds.value.find((f) => f.isDefault);
  form.fundId = byBookDefault?.id || byFlag?.id || funds.value[0]?.id || '';
}

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

/* ────────────── 底部弹层（单选列表：分类更多 / 账户 / 商户 / 项目，支持搜索与创建） ────────────── */
type SheetKind = 'category' | 'fund' | 'shop' | 'project' | null;
const sheetVisible = ref(false);
const sheetData = ref<{
  title: string;
  options: { label: string; value: string }[];
  selected: string;
  kind: SheetKind;
  allowCreate: boolean;
} | null>(null);
const sheetSearch = ref('');

// 最近使用排序（对齐移动端智能排序的兜底：按 lastAccountItemAt 倒序）
function byRecent<T extends { lastAccountItemAt?: string | Date | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ta = a.lastAccountItemAt ? new Date(a.lastAccountItemAt).getTime() : 0;
    const tb = b.lastAccountItemAt ? new Date(b.lastAccountItemAt).getTime() : 0;
    return tb - ta;
  });
}

const filteredSheetOptions = computed(() => {
  if (!sheetData.value) return [];
  const q = sheetSearch.value.trim().toLowerCase();
  if (!q) return sheetData.value.options;
  return sheetData.value.options.filter((o) => o.label.toLowerCase().includes(q));
});

function openSheet(kind: Exclude<SheetKind, null>) {
  // 分类 / 商户走树形选择（对齐移动端 TreeSelectSheet）
  if (kind === 'category' || kind === 'shop') {
    openTreeSheet(kind);
    return;
  }
  let title = '';
  let options: { label: string; value: string }[] = [];
  let selected = '';
  let allowCreate = false;
  switch (kind) {
    case 'fund':
      title = '选择账户';
      options = funds.value.map((f) => ({ label: f.name, value: f.id }));
      selected = form.fundId || '';
      allowCreate = false;
      break;
    case 'project':
      title = '选择项目';
      options = projects.value.map((p) => ({ label: p.name, value: p.code }));
      selected = form.projectCode || '';
      allowCreate = true;
      break;
  }
  sheetSearch.value = '';
  sheetData.value = { title, options, selected, kind, allowCreate };
  sheetVisible.value = true;
}

function pickOption(opt: { label: string; value: string }) {
  if (!sheetData.value) return;
  const kind = sheetData.value.kind;
  if (kind === 'category') form.categoryCode = opt.value;
  else if (kind === 'fund') form.fundId = opt.value;
  else if (kind === 'shop') form.shopCode = opt.value;
  else if (kind === 'project') form.projectCode = opt.value;
  sheetVisible.value = false;
  scheduleAutoSave();
}

function selectCategory(c: any) {
  form.categoryCode = c.code;
  scheduleAutoSave();
}

/* ────────────── 树形选择（分类 / 商户；对齐移动端 TreeSelectSheet：tree / recent / recommend 三视图 + 智能评分） ────────────── */
type TreeKind = 'category' | 'shop' | null;
type TreeViewMode = 'tree' | 'recent' | 'recommend';
const treeSheetVisible = ref(false);
const treeData = ref<{
  title: string;
  kind: TreeKind;
  rows: { node: any; level: number }[];
  selected: string;
  allowCreate: boolean;
  viewMode: TreeViewMode;
} | null>(null);
const treeSearch = ref('');
const treeExpanded = ref<Set<string>>(new Set());
const treeChildren = ref<Map<string, any[]>>(new Map());
// 智能评分（对齐移动端 SmartSortService）：keyed by code
const treeScores = ref<Record<string, number>>({});
const treeHasScore = ref(false);
const treeHasRecent = ref(false);
const treeUserTouchedView = ref(false);
const treeLoadingScores = ref(false);

// ── 智能评分（JS 版 SmartSortService._compute：频率 + 冷静期 + 时段 + 金额相似度） ──
function smartScore(items: any[], currentAmount: number, now: Date): number {
  if (!items.length) return 0;
  let score = 0;
  // 1. 频率 (0-20)
  score += Math.min(items.length * 2, 20);
  // 2. 冷静期 (0-25)
  const sorted = [...items].sort((a, b) => String(b.accountDate).localeCompare(String(a.accountDate)));
  const latestStr = String(sorted[0].accountDate || '');
  const t = Date.parse(latestStr.replace(' ', 'T'));
  if (!Number.isNaN(t)) {
    const hoursSince = (now.getTime() - t) / 3600000;
    if (hoursSince < 1) score += 5;
    else if (hoursSince < 24) score += 5 + 20 * (hoursSince / 24);
    else if (hoursSince < 168) score += 25;
    else score += 25 * Math.max(0, Math.min(1, 1 - (hoursSince - 168) / 720));
  }
  // 3. 时段模式 (0-25)：当前小时 ±2h
  let sameTime = 0;
  for (const it of items) {
    const dt = Date.parse(String(it.accountDate || '').replace(' ', 'T'));
    if (Number.isNaN(dt)) continue;
    const h = new Date(dt).getHours();
    if (Math.abs(h - now.getHours()) <= 2) sameTime++;
  }
  score += Math.min(sameTime * 5, 25);
  // 4. 金额相似度 (0-30)
  if (currentAmount > 0) {
    const absAmount = Math.abs(currentAmount);
    let closestDiff = Infinity;
    for (const it of items) {
      const diff = Math.abs(Math.abs(Number(it.amount) || 0) - absAmount);
      if (diff < closestDiff) closestDiff = diff;
    }
    const ratio = closestDiff / absAmount;
    if (ratio < 0.1) score += 30;
    else if (ratio < 0.25) score += 20;
    else if (ratio < 0.5) score += 10;
    else score += 3;
  }
  return score;
}

async function loadTreeScores(kind: TreeKind, list: any[]) {
  if (kind === 'category' || kind === 'shop') {
    const codeKey = kind === 'category' ? 'categoryCode' : 'shopCode';
    treeScores.value = {};
    if (!list.length) {
      treeHasScore.value = false;
      return;
    }
    const now = new Date();
    const d = new Date(now.getTime() - 30 * 86400000);
    const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      const res: any = await itemApi.list({ accountBookId: app.currentBookId, pageSize: 500, startDate });
      const recent = Array.isArray(res) ? res : (res?.items || []);
      const byCode = new Map<string, any[]>();
      for (const it of recent) {
        const c = it[codeKey];
        if (!c) continue;
        if (!byCode.has(c)) byCode.set(c, []);
        byCode.get(c)!.push(it);
      }
      const amount = Number(form.amount) || 0;
      for (const n of list) {
        treeScores.value[n.code] = smartScore(byCode.get(n.code) || [], amount, now);
      }
      treeHasScore.value = Object.values(treeScores.value).some((s) => s > 0);
    } catch {
      treeHasScore.value = false;
    }
  }
}

function openTreeSheet(kind: 'category' | 'shop') {
  const list = kind === 'category' ? byRecent(filteredCategories.value) : byRecent(shops.value);
  const idSet = new Set(list.map((n: any) => n.code));
  const map = new Map<string, any[]>();
  for (const n of list) {
    const pid = n.parentId && idSet.has(n.parentId) ? n.parentId : '';
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(n);
  }
  const rows: { node: any; level: number }[] = [];
  const children = new Map<string, any[]>();
  const walk = (pid: string, level: number) => {
    for (const k of map.get(pid) || []) {
      rows.push({ node: k, level });
      children.set(k.code, map.get(k.code) || []);
      walk(k.code, level + 1);
    }
  };
  walk('', 0);
  treeChildren.value = children;
  // 默认展开所有父节点（首屏看到完整层级，可手动收起）
  treeExpanded.value = new Set([...children.keys()]);
  treeSearch.value = '';
  treeUserTouchedView.value = false;
  // 最近使用视图前提：任一节点有 lastAccountItemAt
  treeHasRecent.value = rows.some((r) => r.node.lastAccountItemAt);
  treeData.value = {
    title: kind === 'category' ? '选择分类' : '选择商户',
    kind,
    rows,
    selected: kind === 'category' ? form.categoryCode : (form.shopCode || ''),
    allowCreate: true,
    viewMode: 'tree',
  };
  treeSheetVisible.value = true;
  // 异步加载智能评分；有评分且用户未手动切换视图时，默认进推荐视图（对齐移动端）
  treeLoadingScores.value = true;
  loadTreeScores(kind, list).finally(() => {
    treeLoadingScores.value = false;
    if (treeData.value && !treeUserTouchedView.value && treeHasScore.value) {
      treeData.value.viewMode = 'recommend';
    }
  });
}

function setTreeView(mode: TreeViewMode) {
  treeUserTouchedView.value = true;
  if (treeData.value) treeData.value.viewMode = mode;
}

function hasTreeChildren(node: any) {
  if (treeData.value?.viewMode !== 'tree') return false;
  return (treeChildren.value.get(node.code) || []).length > 0;
}

function isTreeExpanded(node: any) {
  return treeExpanded.value.has(node.code);
}

function toggleTreeExpand(node: any) {
  if (treeExpanded.value.has(node.code)) treeExpanded.value.delete(node.code);
  else treeExpanded.value.add(node.code);
  treeExpanded.value = new Set(treeExpanded.value); // 触发响应式
}

// 可见行：tree（展开逻辑）/ recent（最近使用 top20）/ recommend（智能评分 top20）/ 搜索
const visibleTreeRows = computed(() => {
  if (!treeData.value) return [];
  const rows = treeData.value.rows;
  const mode = treeData.value.viewMode;
  const q = treeSearch.value.trim().toLowerCase();

  // 扁平数据（recent / recommend）：flatten 排序取 top20
  const flatSorted = (mode: TreeViewMode) => {
    if (mode === 'recommend' && treeHasScore.value) {
      return rows
        .filter((r) => (treeScores.value[r.node.code] || 0) > 0)
        .sort((a, b) => (treeScores.value[b.node.code] || 0) - (treeScores.value[a.node.code] || 0))
        .slice(0, 20)
        .map((r) => ({ node: r.node, level: 0 }));
    }
    if (mode === 'recent' && treeHasRecent.value) {
      return rows
        .filter((r) => r.node.lastAccountItemAt)
        .sort((a, b) => new Date(b.node.lastAccountItemAt).getTime() - new Date(a.node.lastAccountItemAt).getTime())
        .slice(0, 20)
        .map((r) => ({ node: r.node, level: 0 }));
    }
    return [];
  };

  if (q) {
    if (mode === 'tree') {
      // 树形模式保留祖先链
      const idToNode = new Map(rows.map((r) => [r.node.code, r.node]));
      const matched: typeof rows = [];
      const seen = new Set<string>();
      for (const r of rows) {
        if (!r.node.name.toLowerCase().includes(q)) continue;
        const chain: any[] = [];
        let cur: any = r.node;
        while (cur?.parentId && idToNode.has(cur.parentId)) {
          cur = idToNode.get(cur.parentId)!;
          chain.unshift(cur);
        }
        for (const c of chain) {
          if (!seen.has(c.code)) {
            seen.add(c.code);
            matched.push({ node: c, level: rows.find((x) => x.node.code === c.code)!.level });
          }
        }
        if (!seen.has(r.node.code)) {
          seen.add(r.node.code);
          matched.push(r);
        }
      }
      return matched;
    }
    // 扁平模式直接过滤
    return flatSorted(mode).filter((r) => r.node.name.toLowerCase().includes(q));
  }

  if (mode === 'recent' || mode === 'recommend') {
    return flatSorted(mode);
  }

  // tree 模式：展开状态过滤
  return rows.filter((r) => {
    if (r.level === 0) return true;
    let cur: any = r.node;
    while (cur?.parentId && rows.some((x) => x.node.code === cur.parentId)) {
      const parent = rows.find((x) => x.node.code === cur.parentId)!;
      if (!treeExpanded.value.has(parent.node.code)) return false;
      cur = parent.node;
    }
    return true;
  });
});

function pickTreeNode(node: any) {
  const kind = treeData.value?.kind;
  if (kind === 'category') form.categoryCode = node.code;
  else if (kind === 'shop') form.shopCode = node.code;
  treeSheetVisible.value = false;
  scheduleAutoSave();
}

const creatingTree = ref(false);
async function createTreeOption() {
  if (!treeData.value) return;
  const kind = treeData.value.kind;
  const name = treeSearch.value.trim();
  if (!name) return;
  creatingTree.value = true;
  try {
    const bookId = app.currentBookId;
    let res: any;
    if (kind === 'category') {
      res = await categoryApi.create({
        name,
        code: `c${Date.now()}`,
        categoryType: form.type,
        accountBookId: bookId,
      });
    } else if (kind === 'shop') {
      res = await shopApi.create({ name, code: `s${Date.now()}`, accountBookId: bookId });
    }
    await loadOptions();
    const code = res?.code || res?.id || '';
    if (kind === 'category') form.categoryCode = code;
    else if (kind === 'shop') form.shopCode = code;
    treeSheetVisible.value = false;
    ElMessage.success('已创建');
    scheduleAutoSave();
  } catch { /* 错误已由拦截器提示 */ } finally {
    creatingTree.value = false;
  }
}

/* ────────────── 弹层内创建（分类/商户/项目；对齐移动端 allowCreate） ────────────── */
const creatingSheet = ref(false);
async function createSheetOption() {
  if (!sheetData.value) return;
  const kind = sheetData.value.kind;
  const name = sheetSearch.value.trim();
  if (!name) return;
  creatingSheet.value = true;
  try {
    const bookId = app.currentBookId;
    let res: any;
    if (kind === 'category') {
      res = await categoryApi.create({
        name,
        code: `c${Date.now()}`,
        categoryType: form.type,
        accountBookId: bookId,
      });
    } else if (kind === 'shop') {
      res = await shopApi.create({ name, code: `s${Date.now()}`, accountBookId: bookId });
    } else if (kind === 'project') {
      res = await projectApi.create({ name, code: `p${Date.now()}`, accountBookId: bookId });
    }
    await loadOptions();
    const code = res?.code || res?.id || '';
    if (kind === 'category') form.categoryCode = code;
    else if (kind === 'shop') form.shopCode = code;
    else if (kind === 'project') form.projectCode = code;
    sheetVisible.value = false;
    ElMessage.success('已创建');
    scheduleAutoSave();
  } catch { /* 错误已由拦截器提示 */ } finally {
    creatingSheet.value = false;
  }
}

/* ────────────── 标签多选弹层（对齐移动端 _TagBadge → MultiSelectSheet） ────────────── */
const tagSheetVisible = ref(false);
const tagSheetSearch = ref('');
const tagSelected = ref<string[]>([]);
const filteredTags = computed(() => {
  const q = tagSheetSearch.value.trim().toLowerCase();
  const list = q ? tags.value.filter((t) => t.name.toLowerCase().includes(q)) : tags.value;
  return list;
});
const showCreateTag = computed(() => {
  const q = tagSheetSearch.value.trim();
  return q && !tags.value.some((t) => t.name.toLowerCase() === q.toLowerCase());
});

function openTagSheet() {
  tagSheetSearch.value = '';
  tagSelected.value = [...form.tagCodes];
  tagSheetVisible.value = true;
}

function toggleTag(code: string) {
  const i = tagSelected.value.indexOf(code);
  if (i >= 0) tagSelected.value.splice(i, 1);
  else tagSelected.value.push(code);
}

function confirmTags() {
  form.tagCodes = [...tagSelected.value];
  tagSheetVisible.value = false;
  scheduleAutoSave();
}

const creatingTag = ref(false);
async function createTag() {
  const name = tagSheetSearch.value.trim();
  if (!name) return;
  creatingTag.value = true;
  try {
    const res: any = await tagApi.create({
      name,
      code: `t${Date.now()}`,
      accountBookId: app.currentBookId,
    });
    await loadOptions();
    const code = res?.code || res?.id || '';
    if (code && !tagSelected.value.includes(code)) tagSelected.value.push(code);
    tagSheetSearch.value = '';
  } catch { /* 错误已由拦截器提示 */ } finally {
    creatingTag.value = false;
  }
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

/* ────────────── 附件 ────────────── */
function fmtSize(bytes?: number) {
  const n = Number(bytes ?? 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 懒加载下载中状态（对齐 gui _downloadingIds） */
const downloadingIds = reactive(new Set<string>());

/**
 * 打开附件（懒加载）：GET /api/attachments/:id 由后端代理——
 * 本地缺失时自动从主端下载并缓存再返回文件流。浏览器直接展示/下载。
 */
async function openAttachment(a: any) {
  if (downloadingIds.has(a.id)) return;
  downloadingIds.add(a.id);
  try {
    const res = await fetch(`/api/attachments/${a.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('web_token') || ''}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    ElMessage.error('附件加载失败');
  } finally {
    downloadingIds.delete(a.id);
  }
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
    tagCodes: [...form.tagCodes],
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
  if (!form.fundId) {
    ElMessage.warning('请选择账户');
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
  cursor: pointer;
  transition: background 0.15s ease;
}

.attach-item:hover {
  background: var(--surface-hover);
}

.attach-dl {
  color: var(--brand-gold);
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

.sheet-search {
  margin-bottom: 8px;
}

.tree-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--text-3);
}

.tree-arrow.tree-dot {
  width: 20px;
}

/* 树形面板视图切换（对齐移动端 TreeSelectSheet tabs） */
.tree-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  padding: 0 8px;
}

.tree-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tree-tab:hover {
  background: var(--surface-hover);
}

.tree-tab.on {
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
  font-weight: 600;
}

.tree-tab-loading {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-3);
}

.sheet-create {
  color: var(--brand-gold);
}

.sheet-create .sheet-item-name {
  color: var(--brand-gold);
  font-weight: 600;
}

.sheet-create.loading {
  opacity: 0.6;
  pointer-events: none;
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

.sheet > .sheet-confirm {
  margin-top: 6px;
  border: none;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
  width: 100%;
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
