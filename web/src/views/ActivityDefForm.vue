<template>
  <div class="adf">
    <div class="f-card">
      <div class="f-field">
        <span class="f-field-label">名称</span>
        <el-input v-model="form.name" placeholder="如：晨跑、冥想" maxlength="20" size="large" />
      </div>

      <div class="f-field">
        <span class="f-field-label">图标</span>
        <div class="emoji-trigger" @click="emojiDrawer = true">
          <span class="emoji-trigger-icon">{{ form.emoji || '🎯' }}</span>
          <span class="emoji-trigger-txt">点击选择图标</span>
          <el-icon class="emoji-trigger-arrow"><ArrowRight /></el-icon>
        </div>
      </div>

      <div class="f-field">
        <span class="f-field-label">颜色</span>
        <div class="color-row">
          <button
            v-for="c in PRESET_COLORS"
            :key="c.hex"
            type="button"
            class="color-dot"
            :class="{ on: form.color === c.idx }"
            :style="{ background: c.hex }"
            @click="form.color = c.idx"
          />
        </div>
      </div>

      <div class="f-field">
        <span class="f-field-label">每日最多打卡次数</span>
        <el-input-number v-model="form.maxDailyCount" :min="1" :max="99" placeholder="不填则不限制" style="width: 100%" size="large" />
        <span class="form-hint">不填则视为不限制</span>
      </div>

      <div class="f-field">
        <span class="f-field-label">排序</span>
        <el-input-number v-model="form.sortOrder" :min="0" :max="999" style="width: 100%" size="large" />
      </div>
    </div>

    <!-- ===== 底部固定保存 ===== -->
    <div class="adf-savebar">
      <el-button type="primary" round size="large" class="adf-save" :loading="saving" @click="save">
        <el-icon style="margin-right: 4px"><Check /></el-icon>保存
      </el-button>
    </div>

    <!-- ===== 选择图标：底部抽屉 ===== -->
    <el-drawer v-model="emojiDrawer" direction="btt" size="auto" :with-header="false" :append-to-body="false" class="sheet-drawer">
      <div class="emoji-sheet">
        <div class="sheet-grabber"></div>
        <div class="sheet-head">
          <span class="sheet-title">选择图标</span>
          <button class="sheet-close" @click="emojiDrawer = false">×</button>
        </div>
        <div class="emoji-sheet-body">
          <div v-for="cat in EMOJI_CATEGORIES" :key="cat.name" class="emoji-cat">
            <span class="emoji-cat-name">{{ cat.name }}</span>
            <div class="emoji-grid">
              <button
                v-for="e in cat.list"
                :key="e"
                type="button"
                class="emoji-cell"
                :class="{ on: form.emoji === e }"
                @click="pickEmoji(e)"
              >
                {{ e }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRight, Check } from '@element-plus/icons-vue';
import { activityDefApi } from '@/api';
import { useAppStore } from '@/stores/app';

const route = useRoute();
const app = useAppStore();

const PRESET_COLORS = [
  { idx: 0, hex: '#a78bfa' }, { idx: 1, hex: '#22d3ee' }, { idx: 2, hex: '#10b981' },
  { idx: 3, hex: '#fbbf24' }, { idx: 4, hex: '#f472b6' }, { idx: 5, hex: '#fb7185' },
  { idx: 6, hex: '#60a5fa' }, { idx: 7, hex: '#fb923c' },
];

/** 预设图标（对齐 gui activity_def_edit_page._emojiCategories） */
const EMOJI_CATEGORIES = [
  { name: '运动', list: ['🏃', '🚶', '🏊', '🚴', '🧘', '🤸', '⛹️', '🏋️', '⚽', '🏀', '🎾', '🏸'] },
  { name: '学习', list: ['📖', '✍️', '📝', '📚', '🎓', '💡', '🧠', '📌'] },
  { name: '生活', list: ['💧', '🥗', '☕', '🍎', '🥦', '💊', '🦷', '🧹', '🛌', '🚿'] },
  { name: '健康', list: ['❤️', '💪', '🧘‍♀️', '🌿', '🧴', '🏥', '🩺', '😌'] },
  { name: '爱好', list: ['🎵', '🎨', '🎮', '🎬', '📷', '🎸', '🎹', '🎧', '✈️', '🌍'] },
  { name: '自然', list: ['🌱', '🌻', '🌲', '🌸', '☀️', '🌙', '⭐', '🌈', '🍀'] },
  { name: '其他', list: ['🎯', '⭐', '🔥', '💎', '🎁', '🔔', '💼', '🗂️', '🔄', '💩'] },
];

const saving = ref(false);
const editId = ref('');
const form = reactive({ name: '', emoji: '🎯', color: 0, sortOrder: 0, maxDailyCount: undefined as number | undefined });

const emojiDrawer = ref(false);
function pickEmoji(e: string) {
  form.emoji = e;
  emojiDrawer.value = false;
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入活动名称');
    return;
  }
  saving.value = true;
  try {
    const data: any = {
      name: form.name.trim(), emoji: form.emoji, color: form.color,
      sortOrder: form.sortOrder, accountBookId: app.currentBookId,
    };
    data.maxDailyCount = form.maxDailyCount !== undefined && form.maxDailyCount !== null ? form.maxDailyCount : null;
    if (editId.value) await activityDefApi.update(editId.value, data);
    else await activityDefApi.create(data);
    ElMessage.success(editId.value ? '更新成功' : '创建成功');
    window.history.back();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const seg = route.params.id;
  if (seg && typeof seg === 'string') {
    editId.value = seg;
    try {
      const res: any = await activityDefApi.list({ accountBookId: app.currentBookId });
      const defs = Array.isArray(res) ? res : res?.items || [];
      const d = defs.find((x: any) => x.id === seg);
      if (d) {
        form.name = d.name || '';
        form.emoji = d.emoji || '🎯';
        form.color = typeof d.color === 'number' ? d.color : 0;
        form.sortOrder = d.sortOrder ?? 0;
        form.maxDailyCount = d.maxDailyCount;
      }
    } catch { /* ignore */ }
  }
});
</script>

<style scoped>
.adf {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 0 24px;
}

/* ===== 底部固定保存 ===== */
.adf-savebar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(246, 247, 249, 0), rgba(246, 247, 249, 0.92) 40%, #f6f7f9);
}

.adf-save {
  width: 100%;
  height: 46px;
  border-radius: 23px;
  background: linear-gradient(135deg, #4a8cf7, #2e6be6) !important;
  border: none !important;
  color: #ffffff !important;
  font-size: 15px;
  font-weight: 600;
}

.adf-save:hover,
.adf-save:focus {
  background: linear-gradient(135deg, #5a9aff, #3a7bf0) !important;
  color: #ffffff !important;
}

/* ===== 表单卡 ===== */
.f-card {
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(26, 29, 38, 0.05);
  padding: 16px;
}

.f-field {
  margin-bottom: 16px;
}

.f-field:last-child {
  margin-bottom: 0;
}

.f-field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #8a8f99;
  margin-bottom: 8px;
}

.form-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: #9ca1ad;
}

/* 图标触发器 */
.emoji-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(230, 233, 240, 0.9);
  border-radius: 10px;
  background: #fafbfc;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.emoji-trigger:hover {
  border-color: #2e6be6;
  background: #f6f8fc;
}

.emoji-trigger-icon {
  font-size: 26px;
  line-height: 1;
}

.emoji-trigger-txt {
  flex: 1;
  font-size: 13px;
  color: #8a8f99;
}

.emoji-trigger-arrow {
  color: #c6cbd6;
}

/* 颜色选择 */
.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.color-dot:hover {
  transform: scale(1.1);
}

.color-dot.on {
  border-color: #1a1d26;
  box-shadow: 0 0 0 2px #fff;
}

/* 选择图标抽屉 */
.emoji-sheet {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 20px 20px;
}

.emoji-sheet-body {
  max-height: 46vh;
  overflow-y: auto;
  padding: 4px 4px 8px;
}

.emoji-cat {
  margin-bottom: 10px;
}

.emoji-cat:last-child {
  margin-bottom: 0;
}

.emoji-cat-name {
  display: block;
  font-size: 12px;
  color: #8a8f99;
  margin-bottom: 6px;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.emoji-cell {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: #f6f8fc;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.emoji-cell:hover {
  background: #eceef2;
}

.emoji-cell.on {
  background: #e9f1fe;
  outline: 2px solid #2e6be6;
}

/* 抽屉公共（grabber/head/close 复用） */
.sheet-grabber {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #d8dbe0;
  margin: 8px auto 10px;
}

.sheet-head {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1d26;
  flex: 1;
}

.sheet-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #f0f1f4;
  color: #8a8f99;
  font-size: 16px;
  cursor: pointer;
}
</style>
