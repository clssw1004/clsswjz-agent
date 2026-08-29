<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>加油记录</h2>
        <span class="count">{{ filtered.length }} 条</span>
      </div>
      <el-button type="primary" round :disabled="!vehicles.length" @click="openDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新建记录
      </el-button>
    </div>

    <!-- 车辆筛选 -->
    <div class="filter-bar glass">
      <div class="filter-label">车辆</div>
      <el-select
        v-model="filterVehicleId"
        placeholder="全部车辆"
        clearable
        size="default"
        class="filter-select"
        @change="onFilterChange"
      >
        <el-option
          v-for="v in vehicles"
          :key="v.id"
          :label="`${v.plateNumber}（${v.brand} ${v.model}）`"
          :value="v.id"
        />
      </el-select>
      <div class="filter-stats">
        <span>合计 <b>¥{{ totalAmount.toFixed(2) }}</b></span>
        <span class="dim">|</span>
        <span><b>{{ totalVolume.toFixed(2) }}</b> L</span>
      </div>
    </div>

    <div v-loading="loading" class="record-list">
      <el-empty v-if="!loading && filtered.length === 0" :description="filterVehicleId ? '该车辆暂无加油记录' : '暂无加油记录'" />

      <!-- 桌面：表格 -->
      <el-table
        v-if="!isMobile && filtered.length"
        :data="filtered"
        class="mini-table"
        empty-text="暂无数据"
      >
        <el-table-column label="加油时间" min-width="110">
          <template #default="{ row }">{{ formatTime(row.refuelTime) }}</template>
        </el-table-column>
        <el-table-column label="车辆" min-width="160">
          <template #default="{ row }">{{ vehicleName(row.vehicleId) }}</template>
        </el-table-column>
        <el-table-column label="里程(km)" min-width="100" align="right">
          <template #default="{ row }">{{ Number(row.mileage || 0).toLocaleString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="能源/标号" min-width="110">
          <template #default="{ row }">
            <span class="grade-chip">{{ row.fuelGrade }}</span>
            <span class="energy-sub">{{ energyLabel(row.energyType) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="数量(L)" min-width="90" align="right">
          <template #default="{ row }">{{ Number(row.volume || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="单价" min-width="90" align="right">
          <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="金额" min-width="110" align="right">
          <template #default="{ row }">
            <span class="amount">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
            <el-icon v-if="row.isFullTank" class="full-icon" :size="14"><Check /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="right" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 移动端：卡片 -->
      <div v-else-if="isMobile" class="m-list">
        <div v-for="r in filtered" :key="r.id" class="m-card glass">
          <div class="m-top">
            <span class="m-time">{{ formatTime(r.refuelTime) }}</span>
            <span class="m-amount">¥{{ Number(r.totalAmount || 0).toFixed(2) }}</span>
          </div>
          <div class="m-mid">
            <span class="m-vehicle">{{ vehicleName(r.vehicleId) }}</span>
            <span class="m-grade">{{ r.fuelGrade }}</span>
            <span v-if="r.isFullTank" class="m-full">满箱</span>
          </div>
          <div class="m-detail">
            <span><b>{{ Number(r.volume || 0).toFixed(2) }}</b> L</span>
            <span class="dim">×</span>
            <span>¥{{ Number(r.unitPrice || 0).toFixed(2) }}</span>
            <span class="dim">|</span>
            <span>{{ Number(r.mileage || 0).toLocaleString('zh-CN') }} km</span>
            <span v-if="r.station" class="dim">|</span>
            <span v-if="r.station" class="station">{{ r.station }}</span>
          </div>
          <div v-if="r.remark" class="m-remark">{{ r.remark }}</div>
          <div class="m-ops">
            <button class="m-edit" @click="openDialog(r)">编辑</button>
            <button class="m-del" @click="remove(r)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑加油记录' : '新建加油记录'"
      width="min(520px, 92vw)"
      destroy-on-close
      class="form-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-row">
          <el-form-item label="车辆" prop="vehicleId">
            <el-select v-model="form.vehicleId" placeholder="选择车辆" style="width: 100%" size="large" @change="onVehicleChange">
              <el-option
                v-for="v in activeVehicles"
                :key="v.id"
                :label="`${v.plateNumber}（${v.brand} ${v.model}）`"
                :value="v.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="加油时间" prop="refuelTime">
            <el-date-picker
              v-model="form.refuelTime"
              type="datetime"
              value-format="x"
              format="YYYY-MM-DD HH:mm"
              placeholder="选择时间"
              style="width: 100%"
              size="large"
            />
          </el-form-item>
        </div>

        <div class="form-row">
          <el-form-item label="能源类型" prop="energyType">
            <el-select v-model="form.energyType" style="width: 100%" size="large" @change="onEnergyChange">
              <el-option label="汽油" value="GASOLINE" />
              <el-option label="柴油" value="DIESEL" />
              <el-option label="电" value="ELECTRIC" />
              <el-option label="混动" value="HYBRID" />
            </el-select>
          </el-form-item>
          <el-form-item label="标号" prop="fuelGrade">
            <el-select v-model="form.fuelGrade" placeholder="选择标号" style="width: 100%" size="large">
              <el-option v-for="g in availableGrades" :key="g" :label="g" :value="g" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="当前里程 (km)" prop="mileage">
          <el-input-number v-model="form.mileage" :min="0" :step="1" style="width: 100%" size="large" placeholder="0" />
        </el-form-item>

        <div class="form-row form-3">
          <el-form-item label="数量 (L)" prop="volume">
            <el-input-number
              v-model="form.volume"
              :min="0"
              :precision="2"
              :step="0.01"
              style="width: 100%"
              size="large"
              placeholder="0.00"
              @change="recalcTotal"
            />
          </el-form-item>
          <el-form-item label="单价 (¥/L)" prop="unitPrice">
            <el-input-number
              v-model="form.unitPrice"
              :min="0"
              :precision="2"
              :step="0.01"
              style="width: 100%"
              size="large"
              placeholder="0.00"
              @change="recalcTotal"
            />
          </el-form-item>
          <el-form-item label="金额 (¥)" prop="totalAmount">
            <el-input-number
              v-model="form.totalAmount"
              :min="0"
              :precision="2"
              :step="0.01"
              style="width: 100%"
              size="large"
              placeholder="0.00"
            />
          </el-form-item>
        </div>

        <el-form-item label="是否满箱">
          <div class="switch-row">
            <el-switch v-model="form.isFullTankOn" />
            <span class="switch-label">{{ form.isFullTankOn ? '满箱' : '未满' }}</span>
          </div>
        </el-form-item>

        <el-form-item label="加油站">
          <el-input v-model="form.station" placeholder="选填，如：中石化XX加油站" maxlength="50" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Plus, Check } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { vehicleApi, fuelRecordApi } from '@/api';
import { usePrefsStore } from '@/stores/prefs';
import { useResponsive } from '@/composables/useResponsive';

const { isMobile } = useResponsive();
const prefs = usePrefsStore();

const route = useRoute();

const ENERGY_GRADES: Record<string, string[]> = {
  GASOLINE: ['92#', '95#', '98#'],
  DIESEL: ['0#柴油', '-10#柴油', '-20#柴油', '-35#柴油'],
  ELECTRIC: ['慢充', '快充'],
  HYBRID: ['92#', '95#'],
};

const ENERGY_TYPE_LIST = ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID'];

function energyLabel(t?: string) {
  switch (t) {
    case 'GASOLINE': return '汽油';
    case 'DIESEL': return '柴油';
    case 'ELECTRIC': return '电';
    case 'HYBRID': return '混动';
    default: return t || '-';
  }
}

const FILTER_KEY = 'fuelFilterVehicleId';

const loading = ref(false);
const saving = ref(false);
const records = ref<any[]>([]);
const vehicles = ref<any[]>([]);
const filterVehicleId = ref('');
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const activeVehicles = computed(() => vehicles.value.filter((v) => v.isActive));

const filtered = computed(() => {
  const list = filterVehicleId.value ? records.value.filter((r) => r.vehicleId === filterVehicleId.value) : records.value;
  return [...list].sort((a, b) => (b.refuelTime || 0) - (a.refuelTime || 0));
});

const totalAmount = computed(() => filtered.value.reduce((s, r) => s + Number(r.totalAmount || 0), 0));
const totalVolume = computed(() => filtered.value.reduce((s, r) => s + Number(r.volume || 0), 0));

function vehicleName(id?: string) {
  if (!id) return '-';
  const v = vehicles.value.find((x) => x.id === id);
  return v ? `${v.plateNumber}（${v.brand} ${v.model}）` : '-';
}

function formatTime(t?: number) {
  if (!t) return '-';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const form = reactive({
  id: '',
  vehicleId: '',
  refuelTime: Date.now(),
  mileage: 0,
  energyType: 'GASOLINE',
  fuelGrade: '92#',
  volume: 0,
  unitPrice: 0,
  totalAmount: 0,
  isFullTankOn: false,
  station: '',
  remark: '',
});

const availableGrades = computed(() => ENERGY_GRADES[form.energyType] || []);

const rules: FormRules = {
  vehicleId: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  refuelTime: [{ required: true, message: '请选择加油时间', trigger: 'change' }],
  energyType: [{ required: true, message: '请选择能源类型', trigger: 'change' }],
  fuelGrade: [{ required: true, message: '请选择标号', trigger: 'change' }],
};

async function loadVehicles() {
  try {
    const res: any = await vehicleApi.list();
    vehicles.value = Array.isArray(res) ? res : res?.items || [];
  } catch { /* ignore */ }
}

async function loadRecords() {
  loading.value = true;
  try {
    const res: any = await fuelRecordApi.list();
    records.value = Array.isArray(res) ? res : res?.items || [];
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  if (row) {
    Object.assign(form, {
      id: row.id,
      vehicleId: row.vehicleId,
      refuelTime: row.refuelTime || Date.now(),
      mileage: Number(row.mileage || 0),
      energyType: row.energyType || 'GASOLINE',
      fuelGrade: row.fuelGrade || '92#',
      volume: Number(row.volume || 0),
      unitPrice: Number(row.unitPrice || 0),
      totalAmount: Number(row.totalAmount || 0),
      isFullTankOn: !!row.isFullTank,
      station: row.station || '',
      remark: row.remark || '',
    });
  } else {
    Object.assign(form, {
      id: '',
      vehicleId: filterVehicleId.value || (activeVehicles.value[0]?.id ?? ''),
      refuelTime: Date.now(),
      mileage: 0,
      energyType: 'GASOLINE',
      fuelGrade: '92#',
      volume: 0,
      unitPrice: 0,
      totalAmount: 0,
      isFullTankOn: false,
      station: '',
      remark: '',
    });
  }
  dialogVisible.value = true;
}

function recalcTotal() {
  if (form.volume && form.unitPrice) {
    form.totalAmount = Math.round(form.volume * form.unitPrice * 100) / 100;
  }
}

function onVehicleChange(id: string) {
  // 切换车辆时，如果新车辆有默认标号，且当前标号不在新车辆支持的能源里，则用默认
  const v = vehicles.value.find((x) => x.id === id);
  if (v?.defaultFuelGrade) {
    if (!availableGrades.value.includes(form.fuelGrade)) {
      // 切到该能源时如果默认标号不属于当前能源，则仍按能源默认
    }
    if (availableGrades.value.includes(v.defaultFuelGrade)) {
      form.fuelGrade = v.defaultFuelGrade;
    }
  }
}

function onEnergyChange() {
  if (!availableGrades.value.includes(form.fuelGrade)) {
    form.fuelGrade = availableGrades.value[0] || '';
  }
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const data: any = {
      vehicleId: form.vehicleId,
      refuelTime: form.refuelTime,
      mileage: Number(form.mileage || 0),
      energyType: form.energyType,
      fuelGrade: form.fuelGrade,
      volume: Number(form.volume || 0),
      unitPrice: Number(form.unitPrice || 0),
      totalAmount: Number(form.totalAmount || 0),
      isFullTank: form.isFullTankOn ? 1 : 0,
      station: form.station || null,
      remark: form.remark || null,
    };
    if (form.id) await fuelRecordApi.update(form.id, data);
    else await fuelRecordApi.create(data);
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    await loadRecords();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm('确定删除这条加油记录吗？', '删除确认', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  });
  await fuelRecordApi.delete(row.id);
  ElMessage.success('已删除');
  records.value = records.value.filter((r) => r.id !== row.id);
}

function onFilterChange() {
  if (filterVehicleId.value) {
    prefs.set(FILTER_KEY, filterVehicleId.value).catch(() => {});
  } else {
    prefs.remove(FILTER_KEY).catch(() => {});
  }
}

onMounted(async () => {
  // 确保偏好已加载（app bootstrap 之后才会走到这里，但页面直接进入也兜底）
  await prefs.load();
  await loadVehicles();
  // URL ?vehicleId=xxx 优先级最高；否则用后端偏好
  const vid = route.query.vehicleId;
  if (vid && typeof vid === 'string') {
    filterVehicleId.value = vid;
    prefs.set(FILTER_KEY, vid).catch(() => {});
  } else {
    filterVehicleId.value = prefs.get<string>(FILTER_KEY, '') || '';
  }
  await loadRecords();
});
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
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

.filter-bar.glass {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.filter-select {
  width: 240px;
}

.filter-stats {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-2);
}

.filter-stats b {
  font-size: 15px;
  color: var(--text-1);
  font-weight: 700;
}

.dim {
  color: var(--text-3);
}

/* ===== 表格 ===== */
.mini-table :deep(th.el-table__cell) {
  background: transparent;
  color: var(--text-3);
  font-weight: 600;
}

.mini-table :deep(.el-table__row) {
  background: transparent;
}

.grade-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
  margin-right: 4px;
}

.energy-sub {
  font-size: 11px;
  color: var(--text-3);
}

.amount {
  font-weight: 700;
  color: var(--text-1);
}

.full-icon {
  margin-left: 6px;
  color: var(--color-success);
}

/* ===== 移动端卡片 ===== */
.m-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.m-card.glass {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.m-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.m-time {
  font-size: 13px;
  color: var(--text-2);
  font-weight: 600;
}

.m-amount {
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-gold);
}

.mid-m-top { margin-top: 0; }

.m-mid {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.m-vehicle {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.m-grade {
  padding: 1px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.m-full {
  padding: 1px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(16, 185, 129, 0.14);
  color: #047857;
}

.m-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  flex-wrap: wrap;
}

.m-detail b {
  font-weight: 700;
  color: var(--text-1);
}

.station {
  color: var(--text-3);
}

.m-remark {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-2);
  padding: 6px 10px;
  background: var(--surface-glass-strong);
  border-radius: var(--radius-sm);
  border-left: 2px solid var(--brand-gold);
}

.m-ops {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px dashed var(--border-glass);
}

.m-ops button {
  border: none;
  background: transparent;
  font-size: 13px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.m-edit {
  color: var(--brand-gold);
}

.m-del {
  color: var(--brand-red);
}

/* ===== 表单 ===== */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row.form-3 {
  grid-template-columns: 1fr 1fr 1fr;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.switch-label {
  font-size: 13px;
  color: var(--text-2);
}

@media (max-width: 767px) {
  .filter-bar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .filter-select {
    width: 100%;
  }
  .filter-stats {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }
  .form-row,
  .form-row.form-3 {
    grid-template-columns: 1fr;
  }
}
</style>