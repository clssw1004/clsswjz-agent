<template>
  <div class="note-form-page">
    <el-card class="glass form-card" shadow="never">
      <template #header>
        <span class="card-title">{{ isEdit ? '编辑记事' : '新建记事' }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" v-loading="loading">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" maxlength="100" />
        </el-form-item>

        <el-form-item label="类型" prop="noteType">
          <el-select v-model="form.noteType" placeholder="请选择类型" style="width: 200px">
            <el-option label="笔记" value="NOTE" />
            <el-option label="待办" value="TODO" />
            <el-option label="报告" value="REPORT" />
          </el-select>
        </el-form-item>

        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="10"
            placeholder="请输入内容"
          />
        </el-form-item>

        <div class="actions">
          <el-button @click="router.back()">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { noteApi } from '@/api';
import { useAppStore } from '@/stores/app';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const isEdit = computed(() => !!route.params.id);
const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  title: '',
  noteType: 'NOTE',
  content: '',
});

const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
};

async function load() {
  if (!route.params.id) return;
  loading.value = true;
  try {
    const res: any = await noteApi.get(String(route.params.id));
    Object.assign(form, {
      title: res?.title ?? '',
      noteType: res?.noteType ?? 'NOTE',
      content: res?.content ?? '',
    });
  } finally {
    loading.value = false;
  }
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const data = { ...form, accountBookId: appStore.currentBookId };
    if (isEdit.value) {
      await noteApi.update(String(route.params.id), data);
      ElMessage.success('保存成功');
    } else {
      await noteApi.create(data);
      ElMessage.success('创建成功');
    }
    router.back();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.form-card.glass {
  max-width: 760px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.card-title {
  font-weight: 600;
  color: var(--text-1);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
