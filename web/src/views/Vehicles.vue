<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>车辆管理</h2>
        <span class="count">{{ items.length }} 辆</span>
      </div>
      <el-button type="primary" round @click="openDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新建车辆
      </el-button>
    </div>

    <div v-loading="loading" class="vehicle-grid">
      <el-empty v-if="!loading && items.length === 0" description="暂无车辆，点右上角添加一辆" />

      <div
        v-for="v in items"
        :key="v.id"
        class="vehicle-card glass"
        :class="{ inactive: !v.isActive }"
      >
        <div class="card-top">
          <div class="plate-num">
            <el-icon :size="18" class="plate-icon"><Van /></el-icon>
            <span>{{ v.plateNumber }}</span>
          </div>
          <el-tag v-if="v.isActive" type="success" size="small" effect="light" round>在用</el-tag>
          <el-tag v-else type="info" size="small" effect="light" round>已停用</el-tag>
        </div>

        <div class="card-mid">
          <div class="brand-model">{{ v.brand }} {{ v.model }}</div>
          <div v-if="v.defaultFuelGrade" class="fuel-grade">
            <el-icon :size="12"><Coin /></el-icon>
            {{ v.defaultFuelGrade }}
          </div>
        </div>

        <div v-if="v.remark" class="card-remark">{{ v.remark }}</div>

        <div class="card-actions">
          <el-button link type="primary" size="small" @click="goFuelRecords(v)">
            <el-icon :size="13"><List /></el-icon>
            加油记录
          </el-button>
          <div class="action-right">
            <el-button link type="primary" size="small" @click="openDialog(v)">编辑</el-button>
            <el-button link type="danger" size="small" @click="remove(v)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑车辆' : '新建车辆'"
      width="460px"
      destroy-on-close
      class="form-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="车牌号" prop="plateNumber">
          <el-input v-model="form.plateNumber" placeholder="如：京A12345" maxlength="20" size="large" />
        </el-form-item>
        <div class="form-row">
          <el-form-item label="品牌" prop="brand">
            <el-input v-model="form.brand" placeholder="如：丰田" maxlength="30" size="large" />
          </el-form-item>
          <el-form-item label="型号" prop="model">
            <el-input v-model="form.model" placeholder="如：凯美瑞" maxlength="30" size="large" />
          </el-form-item>
        </div>
        <el-form-item label="默认燃油标号" prop="defaultFuelGrade">
          <el-select v-model="form.defaultFuelGrade" placeholder="选择默认标号" clearable style="width: 100%" size="large">
            <el-option v-for="g in FUEL_GRADES" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
        <el-form-item label="状态">
          <div class="active-row">
            <el-switch v-model="form.isActiveOn" />
            <span class="active-label">{{ form.isActiveOn ? '在用' : '已停用' }}</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus, Van, Coin, List } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { vehicleApi } from '@/api';

const FUEL_GRADES = ['92#', '95#', '98#', '0#柴油', '-20#柴油', '电'];

const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  id: '',
  plateNumber: '',
  brand: '',
  model: '',
  defaultFuelGrade: '' as string,
  remark: '',
  isActiveOn: true,
});

const rules: FormRules = {
  plateNumber: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
  brand: [{ required: true, message: '请输入品牌', trigger: 'blur' }],
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }],
};

const router = useRouter();
const route = useRoute();

async function load() {
  loading.value = true;
  try {
    const res: any = await vehicleApi.list();
    items.value = Array.isArray(res) ? res : res?.items || [];
    items.value.sort((a, b) => {
      if (a.isActive !== b.isActive) return (b.isActive ?? 0) - (a.isActive ?? 0);
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  Object.assign(form, {
    id: row?.id || '',
    plateNumber: row?.plateNumber || '',
    brand: row?.brand || '',
    model: row?.model || '',
    defaultFuelGrade: row?.defaultFuelGrade || '',
    remark: row?.remark || '',
    isActiveOn: row ? !!row.isActive : true,
  });
  dialogVisible.value = true;
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const data: any = {
      plateNumber: form.plateNumber,
      brand: form.brand,
      model: form.model,
      defaultFuelGrade: form.defaultFuelGrade || null,
      remark: form.remark || null,
      isActive: form.isActiveOn ? 1 : 0,
    };
    if (form.id) await vehicleApi.update(form.id, data);
    else await vehicleApi.create(data);
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(
    `确定删除车辆「${row.plateNumber}」吗？\n关联的加油记录不会被删除。`,
    '删除确认',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
  );
  await vehicleApi.delete(row.id);
  ElMessage.success('删除成功');
  await load();
}

function goFuelRecords(v: any) {
  router.push({ path: '/fuel-records', query: { vehicleId: v.id } });
}

onMounted(async () => {
  await load();
  // 携带 ?vehicleId=xxx 直达编辑
  const vid = route.query.vehicleId;
  if (vid && typeof vid === 'string') {
    const found = items.value.find((v) => v.id === vid);
    if (found) openDialog(found);
  }
});
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
}

.page-header-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-1);
}

.count {
  font-size: 13px;
  color: var(--text-3);
}

.page-header :deep(.el-button--primary) {
  background: var(--grad-brand);
  border: none;
  box-shadow: var(--glow-primary);
}

.vehicle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  min-height: 80px;
}

.vehicle-card.glass {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.vehicle-card.glass:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-float);
}

.vehicle-card.inactive {
  opacity: 0.62;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plate-num {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  font-family: 'Menlo', 'Consolas', monospace;
  box-shadow: 0 3px 10px rgba(56, 189, 248, 0.32);
}

.plate-icon {
  font-size: 16px;
}

.vehicle-card.inactive .plate-num {
  background: var(--surface-glass-strong);
  color: var(--text-2);
  box-shadow: none;
}

.card-mid {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.brand-model {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.fuel-grade {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.card-remark {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-2);
  word-break: break-word;
  background: var(--surface-glass-strong);
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border-left: 2px solid var(--brand-gold);
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed var(--border-glass);
}

.action-right {
  display: flex;
  gap: 0;
}

/* ===== 表单 ===== */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.active-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.active-label {
  font-size: 13px;
  color: var(--text-2);
}

@media (max-width: 767px) {
  .vehicle-grid {
    grid-template-columns: 1fr;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>