<!--
  界面布局设置（对齐 gui UiConfigPage / ui_config_dto.dart）
  三个分组卡：记账页设置 / 统计页设置 / 我的页面设置
  - 记账页：组件顺序（跳到首页配置 sheet 调整）+ 项目月度开关 + 新版账目表单开关（本地）
  - 统计页：默认时间范围下拉 + 4 个子开关（账本/项目/分类/活动统计）
  - 我的页面：活动打卡入口开关
  所有配置实时持久化到 usePrefsStore（后端 user_pref 表），与 gui UiConfigDTO 字段对齐。
-->
<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>界面布局</h2>
        <span class="count">按需调整首页、统计页与我的页的显示方式</span>
      </div>
    </div>

    <!-- ========== 记账页设置 ========== -->
    <div class="card glass">
      <div class="card-title">
        <el-icon><Tickets /></el-icon>
        <span>记账页</span>
      </div>

      <div class="setting-switch-row link" @click="$router.push('/items')">
        <div class="setting-info">
          <div class="setting-name">首页组件顺序</div>
          <div class="setting-desc">在首页「记账」Tab 调整组件拖拽与开关</div>
          <div class="setting-order">
            <span
              v-for="(key, i) in itemOrder"
              :key="key"
              class="order-chip"
            >{{ COMPONENT_LABEL[key] || key }}</span>
          </div>
        </div>
        <el-icon class="setting-arrow"><ArrowRight /></el-icon>
      </div>

      <div class="divider" />

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">按项目当月统计</div>
          <div class="setting-desc">显示当月各项目的收入/支出柱状图</div>
        </div>
        <el-switch
          :model-value="itemTabShowProjectMonthly"
          @change="(v) => onBoolChange('itemTabShowProjectMonthly', !!v)"
        />
      </div>

      <div class="divider" />

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">新版账目表单</div>
          <div class="setting-desc">使用全新设计的账目新增 / 编辑页面</div>
        </div>
        <el-switch
          :model-value="useNewItemForm"
          @change="(v) => onBoolChange('useNewItemForm', !!v)"
        />
      </div>
    </div>

    <!-- ========== 统计页设置 ========== -->
    <div class="card glass">
      <div class="card-title">
        <el-icon><DataAnalysis /></el-icon>
        <span>统计页</span>
      </div>

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">默认时间范围</div>
          <div class="setting-desc">
            统计页面默认显示的时间范围
            <span v-if="statisticsSelectedRange === 'custom' && customRangeText" class="custom-hint">
              · {{ customRangeText }}
            </span>
          </div>
        </div>
        <el-select
          :model-value="statisticsSelectedRange"
          style="width: 120px"
          size="small"
          @change="onRangeChange"
        >
          <el-option label="本月" value="month" />
          <el-option label="本年" value="year" />
          <el-option label="本周" value="week" />
          <el-option label="全部" value="all" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </div>

      <template v-if="statisticsSelectedRange === 'custom'">
        <div class="divider" />
        <div class="setting-switch-row">
          <div class="setting-info">
            <div class="setting-name">自定义起止</div>
            <div class="setting-desc">{{ customRangeText || '请选择日期范围' }}</div>
          </div>
          <button class="link-btn" @click="openCustomPicker">选择日期</button>
        </div>
      </template>

      <div class="divider" />

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">账本统计卡片</div>
          <div class="setting-desc">显示收入/支出/余额概览</div>
        </div>
        <el-switch
          :model-value="statisticsShowBookStatistic"
          @change="(v) => onBoolChange('statisticsShowBookStatistic', !!v)"
        />
      </div>

      <div class="divider" />

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">按项目统计</div>
          <div class="setting-desc">显示各项目的收支统计</div>
        </div>
        <el-switch
          :model-value="statisticsShowProjectStatistic"
          @change="(v) => onBoolChange('statisticsShowProjectStatistic', !!v)"
        />
      </div>

      <div class="divider" />

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">分类统计</div>
          <div class="setting-desc">显示分类收支统计</div>
        </div>
        <el-switch
          :model-value="statisticsShowCategoryStatistic"
          @change="(v) => onBoolChange('statisticsShowCategoryStatistic', !!v)"
        />
      </div>

      <div class="divider" />

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">活动统计</div>
          <div class="setting-desc">按活动名称统计次数</div>
        </div>
        <el-switch
          :model-value="statisticsShowActivityStatistic"
          @change="(v) => onBoolChange('statisticsShowActivityStatistic', !!v)"
        />
      </div>
    </div>

    <!-- ========== 我的页面设置 ========== -->
    <div class="card glass">
      <div class="card-title">
        <el-icon><User /></el-icon>
        <span>我的页面</span>
      </div>

      <div class="setting-switch-row">
        <div class="setting-info">
          <div class="setting-name">活动打卡入口</div>
          <div class="setting-desc">在「我的」页面显示活动打卡快速入口</div>
        </div>
        <el-switch
          :model-value="mineTabShowActivityCheckin"
          @change="(v) => onBoolChange('mineTabShowActivityCheckin', !!v)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import {
  Tickets,
  ArrowRight,
  DataAnalysis,
  User,
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { usePrefsStore } from '@/stores/prefs';

/** 默认顺序（与 gui UiConfigDTO 默认一致） */
const DEFAULT_ORDER = [
  'daily_bar',
  'period_status',
  'daily_calendar',
  'user_monthly',
  'activity_recent',
  'debt',
];

/** 组件显示标签（中文 UI 用） */
const COMPONENT_LABEL: Record<string, string> = {
  daily_bar: '本周支出',
  period_status: '经期跟踪',
  daily_calendar: '记账日历',
  user_monthly: '成员本月',
  activity_recent: '最近活动',
  debt: '债务',
};

const prefs = usePrefsStore();

/* ========== 偏好取数（默认 fallback 对齐 gui UiConfigDTO 默认值） ========== */
const itemOrder = computed<string[]>(() => {
  const v = prefs.get<string[]>('itemTabComponentOrder');
  return Array.isArray(v) && v.length ? v : DEFAULT_ORDER.slice();
});

const itemTabShowProjectMonthly = computed(() => prefs.get<boolean>('itemTabShowProjectMonthly', true));
const useNewItemForm = computed(() => prefs.get<boolean>('useNewItemForm', true));
const statisticsSelectedRange = computed(() => prefs.get<string>('statisticsSelectedRange', 'month'));
const statisticsShowBookStatistic = computed(() => prefs.get<boolean>('statisticsShowBookStatistic', true));
const statisticsShowProjectStatistic = computed(() => prefs.get<boolean>('statisticsShowProjectStatistic', true));
const statisticsShowCategoryStatistic = computed(() => prefs.get<boolean>('statisticsShowCategoryStatistic', true));
const statisticsShowActivityStatistic = computed(() => prefs.get<boolean>('statisticsShowActivityStatistic', true));
const mineTabShowActivityCheckin = computed(() => prefs.get<boolean>('mineTabShowActivityCheckin', true));

/* ========== 自定义日期范围 ========== */
const customRangeStart = computed(() => prefs.get<number>('statisticsCustomRangeStart', 0));
const customRangeEnd = computed(() => prefs.get<number>('statisticsCustomRangeEnd', 0));

const customRangeText = computed(() => {
  const s = customRangeStart.value;
  const e = customRangeEnd.value;
  if (!s || !e) return '';
  const f = (ms: number) => {
    const d = new Date(ms);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  };
  return `${f(s)} - ${f(e)}`;
});

/* ========== 写入：实时持久化 + 失败回滚 ========== */
async function onBoolChange(key: string, val: boolean) {
  try {
    await prefs.set(key, val);
  } catch {
    ElMessage.error('保存失败，请稍后重试');
  }
}

async function onRangeChange(val: string | number) {
  if (val === 'custom') {
    await prefs.set('statisticsSelectedRange', 'custom');
    openCustomPicker();
  } else if (typeof val === 'string') {
    try {
      await prefs.set('statisticsSelectedRange', val);
    } catch {
      ElMessage.error('保存失败，请稍后重试');
    }
  }
}

/** 选自定义起止：复用 Element Plus DatePicker dialog（轻量） */
async function openCustomPicker() {
  const { ElMessageBox } = await import('element-plus');
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const f = (d: Date) => {
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  try {
    const res: any = await ElMessageBox.prompt(
      `格式：YYYY-MM-DD（例：${f(lastMonth)} 到 ${f(today)}）`,
      '选择日期范围',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: `${f(lastMonth)} 到 ${f(today)}`,
        inputValue: customRangeText.value || `${f(lastMonth)} 到 ${f(today)}`,
      },
    );
    const v: string = res?.value || '';
    const m = v.match(/(\d{4}-\d{2}-\d{2})\s*到\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) {
      ElMessage.warning('格式不正确，请按示例输入');
      return;
    }
    const start = new Date(m[1]).getTime();
    const end = new Date(m[2]).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      ElMessage.warning('日期范围无效');
      return;
    }
    await prefs.set('statisticsCustomRangeStart', start);
    await prefs.set('statisticsCustomRangeEnd', end);
    await prefs.set('statisticsSelectedRange', 'custom');
  } catch {
    /* 用户取消 */
  }
}

onMounted(() => prefs.load());
</script>

<style scoped>
.settings-page {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 0 32px;
}

/* 与 SyncSettings 同款页头 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
}
.page-header-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-1);
}
.count {
  font-size: 12px;
  color: var(--text-3);
}

/* 卡片（对齐 Mine / ShareSettings 视觉） */
.card {
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--brand-gold);
}
.card-title .el-icon {
  font-size: 16px;
}

/* 「标题 + 描述 + 控件」行 */
.setting-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  transition: background 0.15s ease;
}
.setting-switch-row.link {
  cursor: pointer;
}
.setting-switch-row.link:hover {
  background: var(--surface-hover);
}
.setting-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.setting-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.setting-desc {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}
.setting-arrow {
  color: var(--text-3);
  font-size: 14px;
  flex-shrink: 0;
}

/* 组件顺序预览（tags-like 胶囊串） */
.setting-order {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}
.order-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--brand-gold);
  background: rgba(46, 107, 229, 0.08);
  border: 1px solid rgba(46, 107, 229, 0.18);
}

.divider {
  height: 1px;
  margin: 0 16px;
  background: var(--border-glass);
}

.custom-hint {
  color: var(--brand-gold);
  font-weight: 500;
  margin-left: 4px;
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--brand-gold);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
}
.link-btn:hover {
  background: rgba(46, 107, 229, 0.08);
}
</style>
