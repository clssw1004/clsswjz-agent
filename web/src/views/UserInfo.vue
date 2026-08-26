<template>
  <div class="user-page">
    <Panel noPad>
      <div class="page-head">
        <button class="back-btn" @click="router.back()"><el-icon><ArrowLeft /></el-icon></button>
        <span class="page-title">个人信息</span>
        <span class="head-spacer"></span>
      </div>
    </Panel>

    <div v-loading="loading" class="user-body">
      <!-- 头像区（对齐 gui _buildAvatarSection） -->
      <div class="avatar-card glass">
        <button class="avatar-big" :disabled="uploadingAvatar" @click="pickAvatar">
          <img v-if="avatarUrl" :src="avatarUrl" alt="头像" />
          <span v-else>{{ avatarText }}</span>
          <span v-if="uploadingAvatar" class="avatar-mask"><i class="spinner"></i></span>
          <span class="avatar-edit"><el-icon :size="13"><Camera /></el-icon></span>
        </button>
        <div class="avatar-name">{{ form.nickname || '未设置' }}</div>
        <div class="avatar-username mono">{{ form.username }}</div>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onAvatarPicked" />
      </div>

      <!-- 基本信息（对齐 gui _buildAccountSection：只读 username/inviteCode） -->
      <section class="u-section">
        <div class="sec-head"><el-icon :size="15"><Document /></el-icon><span>基本信息</span><i></i></div>
        <div class="group-card glass">
          <div class="field-row">
            <span class="field-label">用户名</span>
            <span class="field-value">{{ form.username || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">邀请码</span>
            <span class="field-value mono ellipsis">{{ form.inviteCode || '-' }}</span>
            <button v-if="form.inviteCode" class="mini-btn" title="复制" @click="copyInvite">
              <el-icon :size="14"><CopyDocument /></el-icon>
            </button>
          </div>
        </div>
      </section>

      <!-- 个人信息（可编辑，对齐 gui _buildPersonalSection） -->
      <section class="u-section">
        <div class="sec-head"><el-icon :size="15"><User /></el-icon><span>个人信息</span><i></i></div>
        <div class="group-card glass">
          <div class="edit-row">
            <span class="field-label">昵称</span>
            <el-input v-model="form.nickname" placeholder="设置昵称" size="default" maxlength="50" />
          </div>
          <div class="edit-row">
            <span class="field-label">邮箱</span>
            <el-input v-model="form.email" placeholder="设置邮箱" size="default" />
          </div>
          <div class="edit-row">
            <span class="field-label">手机号</span>
            <el-input v-model="form.phone" placeholder="设置手机号" size="default" />
          </div>
        </div>
      </section>

      <el-button type="primary" class="save-btn grad-btn" :loading="saving" @click="saveProfile">保存修改</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Camera, Document, CopyDocument, User } from '@element-plus/icons-vue';
import { userApi, authApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import Panel from '@/components/Panel.vue';

const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const uploadingAvatar = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const avatarUrl = ref('');

const form = reactive({
  username: '',
  nickname: '',
  email: '',
  phone: '',
  inviteCode: '',
});

const avatarText = computed(() => (form.nickname || 'U').slice(0, 1).toUpperCase());

async function loadProfile() {
  loading.value = true;
  try {
    const res: any = await userApi.profile();
    const p = res?.data ?? res ?? {};
    form.username = p.username || '';
    form.nickname = p.nickname || '';
    form.email = p.email || '';
    form.phone = p.phone || '';
    form.inviteCode = p.inviteCode || '';
    if (p.avatar) {
      // 懒加载：<img> 直接请求下载端点，后端缺失文件时自动从主端拉取
      avatarUrl.value = `${attachmentUrl(p.avatar)}?t=${Date.now()}`;
    }
  } finally {
    loading.value = false;
  }
}

function attachmentUrl(id: string) {
  return `/api/attachments/${id}`;
}

function pickAvatar() {
  fileInput.value?.click();
}

async function onAvatarPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 8MB');
    input.value = '';
    return;
  }
  uploadingAvatar.value = true;
  try {
    await userApi.uploadAvatar(file);
    ElMessage.success('头像已更新');
    await loadProfile();
    await auth.fetchMe(); // 刷新顶栏昵称
  } catch { /* 错误已由拦截器提示 */ }
  finally {
    uploadingAvatar.value = false;
    input.value = '';
  }
}

async function saveProfile() {
  if (!form.nickname.trim()) {
    ElMessage.warning('昵称不能为空');
    return;
  }
  saving.value = true;
  try {
    await userApi.updateProfile({
      nickname: form.nickname.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
    });
    ElMessage.success('已保存');
    await auth.fetchMe();
  } catch { /* 错误已由拦截器提示 */ }
  finally { saving.value = false; }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(form.inviteCode);
    ElMessage.success('已复制');
  } catch {
    ElMessage.error('复制失败');
  }
}

onMounted(loadProfile);
</script>

<style scoped>
.user-page {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

.page-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.back-btn {
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: inline-flex;
}

.back-btn:hover { background: var(--surface-hover); }

.page-title {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.head-spacer { width: 30px; }

.user-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 160px;
}

/* 头像卡 */
.avatar-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 0 22px;
  gap: 4px;
}

.avatar-big {
  position: relative;
  width: 92px;
  height: 92px;
  border: none;
  border-radius: 50%;
  background: var(--grad-brand);
  color: #fff;
  font-size: 36px;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  box-shadow: var(--glow-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-big img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.avatar-edit {
  position: absolute;
  right: 2px;
  bottom: 2px;
  z-index: 2;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-name {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
}

.avatar-username {
  font-size: 12px;
  color: var(--brand-gold);
  background: var(--brand-gold-soft);
  padding: 3px 12px;
  border-radius: 999px;
}

/* 区块 */
.u-section { display: flex; flex-direction: column; gap: 10px; }

.sec-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-gold);
  padding: 0 4px;
}

.sec-head i {
  flex: 1;
  height: 1px;
  background: var(--border-glass);
}

.group-card.glass {
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  overflow: hidden;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}

.field-row + .field-row { border-top: 1px solid var(--border-glass); }

.field-label {
  width: 64px;
  flex-shrink: 0;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-2);
}

.field-value {
  flex: 1;
  font-size: 14px;
  color: var(--text-1);
  min-width: 0;
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-btn {
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
}

.mini-btn:hover { background: var(--surface-hover); color: var(--brand-gold); }

.edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
}

.edit-row + .edit-row { border-top: 1px solid var(--border-glass); }

.save-btn {
  width: 100%;
  height: 44px;
  font-weight: 600;
}
</style>
