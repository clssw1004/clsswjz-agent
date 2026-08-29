<template>
  <div class="fuel">
    <!-- ===== 头部：标题 + 管理/新建 ===== -->
    <div class="fuel-head">
      <div class="fuel-title-row">
        <h2>加油记录</h2>
        <span class="fuel-count">{{ filtered.length }} 条</span>
      </div>
      <div class="fuel-actions">
        <el-button round class="veh-manage" @click="goVehicles">
          <el-icon :size="15"><Setting /></el-icon>
          <span>管理</span>
        </el-button>
        <el-button type="primary" round class="fuel-add" :disabled="!vehicles.length" @click="openDialog()">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>
          加油
        </el-button>
      </div>
    </div>

    <!-- ===== 车辆选择条 ===== -->
    <div class="veh-bar glass-card">
      <el-icon class="veh-ic" :size="20"><Van /></el-icon>
      <el-select v-model="filterVehicleId" placeholder="全部车辆" clearable size="default" class="veh-select" @change="onFilterChange">
        <el-option v-for="v in vehicles" :key="v.id" :label="`${v.plateNumber}（${v.brand} ${v.model}）`" :value="v.id" />
      </el-select>
      <span class="veh-stat">{{ filtered.length }} 条记录</span>
    </div>

    <!-- ===== 统计卡（2×3） ===== -->
    <div class="fuel-stats glass-card">
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-v stat-blue">¥{{ totalAmount.toFixed(2) }}</span>
          <span class="stat-l">总费用</span>
        </div>
        <span class="stat-div"></span>
        <div class="stat-item">
          <span class="stat-v">{{ totalMileage.toLocaleString('zh-CN') }} km</span>
          <span class="stat-l">总里程</span>
        </div>
        <span class="stat-div"></span>
        <div class="stat-item">
          <span class="stat-v">{{ totalVolume.toFixed(2) }} L</span>
          <span class="stat-l">总油量</span>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-v stat-green">{{ avgConsumption || '--' }}</span>
          <span class="stat-l">平均油耗 L/100km</span>
        </div>
        <span class="stat-div"></span>
        <div class="stat-item">
          <span class="stat-v">¥{{ avgCostPerKm }}</span>
          <span class="stat-l">每公里费用</span>
        </div>
        <span class="stat-div"></span>
        <div class="stat-item">
          <span class="stat-v">{{ filtered.length }} 次</span>
          <span class="stat-l">记录次数</span>
        </div>
      </div>
    </div>

    <!-- ===== 时间线列表 ===== -->
    <div v-loading="loading" class="tl">
      <el-empty v-if="!loading && filtered.length === 0" :description="filterVehicleId ? '该车辆暂无加油记录' : '暂无加油记录'" />
      <div v-for="(r, i) in filtered" :key="r.id" class="tl-entry">
        <div class="tl-col">
          <span class="tl-dot"></span>
          <span v-if="i < filtered.length - 1" class="tl-line"></span>
        </div>
        <div class="tl-content">
          <div class="tl-head">
            <span class="tl-time">{{ formatTime(r.refuelTime) }}</span>
            <span v-if="tripKm(r, i) > 0" class="tl-km">+{{ tripKm(r, i) }} km</span>
            <button class="tl-del" @click="remove(r)"><el-icon :size="16"><Delete /></el-icon></button>
          </div>
          <div class="fuel-card" @click="openDialog(r)">
            <div class="fc-top">
              <span class="fc-eco"><el-icon :size="14" style="margin-right: 3px"><CircleCheck /></el-icon>{{ fuelConsumptionText(r, i) }}</span>
              <span class="fc-edit"><el-icon :size="13"><Edit /></el-icon>编辑</span>
            </div>
            <div class="fc-mid">
              <div class="fc-cell">
                <span class="fc-v stat-blue">¥{{ Number(r.totalAmount || 0).toFixed(2) }}</span>
                <span class="fc-l">金额</span>
              </div>
              <span class="fc-div"></span>
              <div class="fc-cell">
                <span class="fc-v">{{ Number(r.unitPrice || 0).toFixed(2) }}</span>
                <span class="fc-l">元/L</span>
              </div>
              <span class="fc-div"></span>
              <div class="fc-cell">
                <span class="fc-v">{{ Number(r.volume || 0).toFixed(2) }}</span>
                <span class="fc-l">L</span>
              </div>
            </div>
            <div class="fc-sub">
              <span class="fc-sub-t">总里程 {{ Number(r.mileage || 0).toLocaleString('zh-CN') }} km</span>
              <span class="fc-sub-dot"></span>
              <span class="fc-sub-t">每公里 ¥{{ costPerKm(r, i) }}</span>
            </div>
            <div class="fc-badges">
              <span v-if="r.isFullTank" class="fc-badge full">跳枪</span>
              <span v-if="r.isFuelLightOn" class="fc-badge light">油灯亮</span>
              <span class="fc-grade">{{ gradeText(r) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 新建/编辑：底部抽屉（对齐设计稿第二屏） ===== -->
    <el-drawer v-model="dialogVisible" direction="btt" size="auto" :with-header="false" :append-to-body="false" class="fuel-sheet">
      <div class="sheet">
        <div class="sheet-grabber"></div>
        <div class="sheet-head">
          <span class="sheet-title">{{ form.id ? '编辑加油记录' : '新建加油记录' }}</span>
          <button class="sheet-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="sheet-body">
          <div class="f-card">
            <!-- 车辆 -->
            <div class="f-row">
              <span class="f-label">车辆</span>
              <el-select v-model="form.vehicleId" class="f-select" placeholder="选择车辆" @change="onVehicleChange">
                <el-option v-for="v in activeVehicles" :key="v.id" :label="`${v.brand} ${v.model} · ${v.plateNumber}`" :value="v.id" />
              </el-select>
            </div>
            <div class="f-div"></div>
            <!-- 加油时间 -->
            <div class="f-row">
              <span class="f-label">加油时间</span>
              <el-date-picker
                v-model="form.refuelTime"
                type="datetime"
                value-format="x"
                format="YYYY/MM/DD HH:mm"
                class="f-date"
                placeholder="选择时间"
                :clearable="false"
              />
            </div>
            <div class="f-div"></div>
            <!-- 里程表读数 -->
            <div class="f-row">
              <span class="f-label">里程表读数</span>
              <div class="f-mile">
                <el-input-number v-model="form.mileage" :controls="false" :min="0" :step="1" class="f-mile-input" placeholder="0" />
                <span class="f-mile-unit">km</span>
              </div>
            </div>
            <div class="f-div"></div>
            <!-- 能源类型 segmented -->
            <span class="f-sec-label">能源类型</span>
            <div class="f-seg">
              <button
                v-for="e in ENERGY_TYPE_LIST"
                :key="e"
                type="button"
                class="f-seg-item"
                :class="{ on: form.energyType === e }"
                @click="onEnergyChange(e)"
              >
                {{ energyLabel(e) }}
              </button>
            </div>
            <!-- 油号 chips -->
            <span class="f-sec-label">油号</span>
            <div class="f-chips">
              <button
                v-for="g in availableGrades"
                :key="g"
                type="button"
                class="f-chip"
                :class="{ on: form.fuelGrade === g }"
                @click="form.fuelGrade = g"
              >
                {{ g }}
              </button>
            </div>
            <!-- 数量 / 单价 / 金额 -->
            <div class="f-num-head">
              <span class="f-sec-label">数量 / 单价 / 金额</span>
              <span class="f-auto">已自动计算</span>
            </div>
            <div class="f-cols">
              <div class="f-col">
                <el-input-number v-model="form.volume" :controls="false" :precision="2" :min="0" class="f-num" placeholder="0.00" @change="recalcTotal" />
                <span class="f-col-unit">L 升</span>
              </div>
              <div class="f-col">
                <el-input-number v-model="form.unitPrice" :controls="false" :precision="2" :min="0" class="f-num" placeholder="0.00" @change="recalcTotal" />
                <span class="f-col-unit">¥/L</span>
              </div>
              <div class="f-col hl">
                <el-input-number v-model="form.totalAmount" :controls="false" :precision="2" :min="0" class="f-num hl" placeholder="0.00" />
                <span class="f-col-unit hl">总额</span>
              </div>
            </div>
            <!-- 加油状态：满箱 + 油灯 -->
            <span class="f-sec-label">加油状态</span>
            <div class="f-sw-row">
              <button type="button" class="f-sw full" :class="{ on: form.isFullTankOn }" @click="form.isFullTankOn = !form.isFullTankOn">
                <span class="f-sw-txt">满箱<span class="f-sw-sub">跳枪</span></span>
                <span class="f-sw-dot" :class="{ on: form.isFullTankOn }"></span>
              </button>
              <button type="button" class="f-sw light" :class="{ on: form.isFuelLightOn }" @click="form.isFuelLightOn = !form.isFuelLightOn">
                <span class="f-sw-txt">油灯亮<span class="f-sw-sub">用于油耗</span></span>
                <span class="f-sw-dot" :class="{ on: form.isFuelLightOn }"></span>
              </button>
            </div>
            <div class="f-div"></div>
            <!-- 加油站 -->
            <div class="f-field">
              <span class="f-field-label">加油站</span>
              <el-input v-model="form.station" class="f-input" placeholder="如：中石化五道口加油站" maxlength="50" />
            </div>
            <!-- 备注 -->
            <div class="f-field">
              <span class="f-field-label">备注</span>
              <el-input v-model="form.remark" type="textarea" :rows="2" class="f-textarea" placeholder="选填，如：加满 95#，自动加油机" maxlength="100" />
            </div>
          </div>
          <el-button type="primary" round size="large" class="sheet-save" :loading="saving" @click="save">
            <el-icon style="margin-right: 4px"><Check /></el-icon>{{ form.id ? '保存修改' : '保存记录' }}
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus, Delete, Edit, Van, CircleCheck, Check, Setting } from '@element-plus/icons-vue';
import type { FormInstance } from 'element-plus';
import { vehicleApi, fuelRecordApi } from '@/api';
import { usePrefsStore } from '@/stores/prefs';

const prefs = usePrefsStore();
const router = useRouter();

function goVehicles() {
  router.push('/vehicles');
}
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

function gradeText(r: any) {
  if (r.energyType === 'DIESEL') return r.fuelGrade || '-';
  return `${r.fuelGrade || '--'}`;
}

const FILTER_KEY = 'fuelFilterVehicleId';
const loading = ref(false);
const saving = ref(false);
const records = ref<any[]>([]);
const vehicles = ref<any[]>([]);
const filterVehicleId = ref('');
const dialogVisible = ref(false);

const activeVehicles = computed(() => vehicles.value.filter((v) => v.isActive));

/** 按 refuelTime 降序（最新在前） */
const filtered = computed(() => {
  const list = filterVehicleId.value ? records.value.filter((r) => r.vehicleId === filterVehicleId.value) : records.value;
  return [...list].sort((a, b) => (b.refuelTime || 0) - (a.refuelTime || 0));
});

/** 总费用 / 总油量 */
const totalAmount = computed(() => filtered.value.reduce((s, r) => s + Number(r.totalAmount || 0), 0));
const totalVolume = computed(() => filtered.value.reduce((s, r) => s + Number(r.volume || 0), 0));

/** 行驶总里程 = 相邻记录里程差之和 */
const totalMileage = computed(() => {
  let sum = 0;
  for (let i = 0; i < filtered.value.length - 1; i++) {
    const diff = (Number(filtered.value[i].mileage) || 0) - (Number(filtered.value[i + 1].mileage) || 0);
    if (diff > 0) sum += diff;
  }
  return sum;
});

/** 平均油耗：满箱记录的油耗均值（L/100km） */
const avgConsumption = computed(() => {
  const cons = filtered.value.map((r, i) => fuelConsumption(r, i)).filter((v) => v > 0);
  if (!cons.length) return '--';
  return (cons.reduce((s, v) => s + v, 0) / cons.length).toFixed(1);
});

const avgCostPerKm = computed(() => {
  if (totalMileage.value <= 0) return '0.00';
  return (totalAmount.value / totalMileage.value).toFixed(2);
});

/** 里程差：当前记录与下一条更早记录的里程差 */
function tripKm(r: any, i: number) {
  const next = filtered.value[i + 1];
  if (!next) return 0;
  const diff = (Number(r.mileage) || 0) - (Number(next.mileage) || 0);
  return diff > 0 ? diff : 0;
}

function costPerKm(r: any, i: number) {
  const km = tripKm(r, i);
  if (km <= 0 || !Number(r.totalAmount)) return '--';
  return (Number(r.totalAmount) / km).toFixed(2);
}

function fuelConsumption(r: any, i: number) {
  const km = tripKm(r, i);
  if (km <= 0 || !Number(r.volume)) return 0;
  return (Number(r.volume) / km) * 100;
}

function fuelConsumptionText(r: any, i: number) {
  const v = fuelConsumption(r, i);
  if (v <= 0) return '-- L/100km';
  return `${v.toFixed(1)} L/100km`;
}

function formatTime(t?: number) {
  if (!t) return '-';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const form = reactive({
  id: '', vehicleId: '', refuelTime: Date.now(), mileage: 0,
  energyType: 'GASOLINE', fuelGrade: '92#', volume: 0, unitPrice: 0,
  totalAmount: 0, isFullTankOn: false, isFuelLightOn: false, station: '', remark: '',
});

const availableGrades = computed(() => ENERGY_GRADES[form.energyType] || []);

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
      id: row.id, vehicleId: row.vehicleId, refuelTime: row.refuelTime || Date.now(),
      mileage: Number(row.mileage || 0), energyType: row.energyType || 'GASOLINE',
      fuelGrade: row.fuelGrade || '92#', volume: Number(row.volume || 0),
      unitPrice: Number(row.unitPrice || 0), totalAmount: Number(row.totalAmount || 0),
      isFullTankOn: !!row.isFullTank, isFuelLightOn: !!row.isFuelLightOn,
      station: row.station || '', remark: row.remark || '',
    });
  } else {
    Object.assign(form, {
      id: '', vehicleId: filterVehicleId.value || (activeVehicles.value[0]?.id ?? ''),
      refuelTime: Date.now(), mileage: 0, energyType: 'GASOLINE', fuelGrade: '92#',
      volume: 0, unitPrice: 0, totalAmount: 0, isFullTankOn: false, isFuelLightOn: false,
      station: '', remark: '',
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
  const v = vehicles.value.find((x) => x.id === id);
  if (v?.defaultFuelGrade && availableGrades.value.includes(v.defaultFuelGrade)) {
    form.fuelGrade = v.defaultFuelGrade;
  }
}

function onEnergyChange(e: string) {
  form.energyType = e;
  if (!availableGrades.value.includes(form.fuelGrade)) {
    form.fuelGrade = availableGrades.value[0] || '';
  }
}

async function save() {
  if (!form.vehicleId) {
    ElMessage.warning('请选择车辆');
    return;
  }
  if (!form.refuelTime) {
    ElMessage.warning('请选择加油时间');
    return;
  }
  saving.value = true;
  try {
    const data: any = {
      vehicleId: form.vehicleId, refuelTime: form.refuelTime, mileage: Number(form.mileage || 0),
      energyType: form.energyType, fuelGrade: form.fuelGrade, volume: Number(form.volume || 0),
      unitPrice: Number(form.unitPrice || 0), totalAmount: Number(form.totalAmount || 0),
      isFullTank: form.isFullTankOn ? 1 : 0, isFuelLightOn: form.isFuelLightOn ? 1 : 0,
      station: form.station || null, remark: form.remark || null,
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
  await prefs.load();
  await loadVehicles();
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
.fuel {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 4px 24px;
}

.glass-card {
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(26, 29, 38, 0.05);
}

/* ===== 头部 ===== */
.fuel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 12px 0;
  gap: 12px;
}

.fuel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.fuel-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.fuel-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1d26;
}

.fuel-count {
  font-size: 12px;
  color: #8a8f99;
}

.fuel-head :deep(.el-button--primary) {
  background: linear-gradient(135deg, #4a8cf7, #2e6be6);
  border: none;
  border-radius: 18px;
}

/* ===== 车辆条 ===== */
.veh-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 0 12px;
}

.veh-ic {
  color: #8a8f99;
  flex-shrink: 0;
}

.veh-select {
  flex: 1;
  min-width: 0;
}

.veh-select :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
}

.veh-stat {
  font-size: 12px;
  color: #9ca1ad;
  flex-shrink: 0;
}

/* 管理按钮：与「加油」主按钮同尺寸风格（32px 圆角胶囊） */
.veh-manage {
  background: #f0f1f4 !important;
  border: none !important;
  color: #2e6be6 !important;
}

.veh-manage:hover {
  background: #e4e6eb !important;
  color: #2e6be6 !important;
}

/* ===== 统计卡 2×3 ===== */
.fuel-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 0;
  margin: 0 12px;
}

.stats-row {
  display: flex;
  align-items: center;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-v {
  font-size: 17px;
  font-weight: 700;
  color: #1a1d26;
  font-family: Inter, sans-serif;
}

.stat-blue {
  color: #2e6be6;
}

.stat-green {
  color: #3ba55d;
}

.stat-l {
  font-size: 11px;
  color: #9ca1ad;
}

.stat-div {
  width: 1px;
  height: 34px;
  background: #eceef2;
}

/* ===== 时间线 ===== */
.tl {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 12px;
  min-height: 80px;
}

.tl-entry {
  display: flex;
  gap: 8px;
}

.tl-col {
  width: 20px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tl-dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #2e6be6;
  border: 2.5px solid #fff;
  box-shadow: 0 0 4px rgba(46, 107, 230, 0.3);
  margin-top: 2px;
}

.tl-line {
  width: 2px;
  flex: 1;
  min-height: 30px;
  background: #e3e7ee;
}

.tl-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tl-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 4px;
}

.tl-time {
  font-size: 12px;
  font-weight: 500;
  color: #9ca1ad;
}

.tl-km {
  font-size: 14px;
  font-weight: 700;
  color: #1a1d26;
  margin-left: auto;
}

.tl-del {
  border: none;
  background: transparent;
  color: #f2573e;
  cursor: pointer;
  padding: 4px;
  display: flex;
}

/* ===== FuelCard ===== */
.fuel-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.fuel-card:hover {
  transform: translateY(-1px);
  border-color: rgba(46, 107, 230, 0.35);
}

.fc-top {
  display: flex;
  align-items: center;
}

.fc-eco {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: #3ba55d;
  flex: 1;
}

.fc-edit {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #9ca1ad;
}

.fc-mid {
  display: flex;
  align-items: center;
}

.fc-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.fc-v {
  font-size: 18px;
  font-weight: 700;
  color: #1a1d26;
  font-family: Inter, sans-serif;
}

.fc-l {
  font-size: 11px;
  color: #9ca1ad;
}

.fc-div {
  width: 1px;
  height: 30px;
  background: #eceef2;
}

.fc-sub {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.fc-sub-t {
  font-size: 12px;
  color: #9ca1ad;
}

.fc-sub-dot {
  width: 1px;
  height: 12px;
  background: #eceef2;
}

.fc-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fc-badge {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
}

.fc-badge.full {
  background: #e8f5e9;
  color: #2e7d32;
}

.fc-badge.light {
  background: #fff3e0;
  color: #e65100;
}

.fc-grade {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: #9ca1ad;
}

/* ===== 抽屉 ===== */
.sheet {
  max-width: 480px;
  margin: 0 auto;
  padding: 12px 20px 24px;
}

.sheet-grabber {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #d8dbe0;
  margin: 0 auto 10px;
}

.sheet-head {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
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

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ===== 表单卡 ===== */
.f-card {
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(26, 29, 38, 0.05);
  padding: 4px 16px 16px;
}

/* 行 */
.f-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  gap: 12px;
}

.f-label {
  font-size: 14px;
  color: #8a8f99;
  flex-shrink: 0;
}

.f-div {
  height: 1px;
  background: #f0f1f4;
  margin: 2px 0;
}

/* 车辆 select 透明化 */
.f-select {
  flex: 1;
  max-width: 240px;
}

.f-select :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding-right: 0;
}

.f-select :deep(.el-input__inner) {
  text-align: right;
  font-size: 15px;
  font-weight: 600;
  color: #1a1d26;
}

.f-select :deep(.el-select__caret) {
  color: #8a8f99;
}

/* 时间 picker 透明化 */
.f-date {
  flex: 1;
  max-width: 240px;
}

.f-date :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding-right: 0;
}

.f-date :deep(.el-input__inner) {
  text-align: right;
  font-size: 14px;
  font-weight: 500;
  color: #1a1d26;
}

.f-date :deep(.el-input__suffix) {
  display: none;
}

/* 里程大数字 */
.f-mile {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.f-mile-input {
  width: 150px;
}

.f-mile-input :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding-right: 0;
}

.f-mile-input :deep(.el-input__inner) {
  text-align: right;
  font-size: 18px;
  font-weight: 700;
  color: #1a1d26;
  font-family: Inter, sans-serif;
}

.f-mile-unit {
  font-size: 13px;
  color: #8a8f99;
}

/* 分段 / chips */
.f-sec-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #8a8f99;
  margin: 14px 0 8px;
}

.f-seg {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 18px;
  background: #eaecf1;
}

.f-seg-item {
  flex: 1;
  height: 30px;
  border: none;
  border-radius: 15px;
  background: transparent;
  color: #8a8f99;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.f-seg-item.on {
  background: #ffffff;
  color: #1a1d26;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(26, 29, 38, 0.08);
}

.f-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.f-chip {
  height: 36px;
  padding: 0 18px;
  border: none;
  border-radius: 18px;
  background: #f0f1f4;
  color: #8a8f99;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.f-chip.on {
  background: #2e6be6;
  color: #ffffff;
  font-weight: 600;
}

/* 三列 */
.f-num-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.f-num-head .f-sec-label {
  margin-bottom: 8px;
}

.f-auto {
  font-size: 11px;
  color: #3ba55d;
  margin-bottom: 8px;
}

.f-cols {
  display: flex;
  gap: 8px;
}

.f-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px 10px;
  border-radius: 10px;
  background: #f6f8fc;
}

.f-col.hl {
  background: #e9f1fe;
}

.f-num {
  width: 100%;
}

.f-num :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding: 0;
}

.f-num :deep(.el-input__inner) {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: #1a1d26;
  font-family: Inter, sans-serif;
}

.f-num.hl :deep(.el-input__inner) {
  color: #2e6be6;
}

.f-col-unit {
  font-size: 11px;
  color: #8a8f99;
}

.f-col-unit.hl {
  color: #2e6be6;
  font-weight: 500;
}

/* 满箱 / 油灯 开关 */
.f-sw-row {
  display: flex;
  gap: 12px;
}

.f-sw {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 46px;
  padding: 0 14px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #f0f1f4;
}

.f-sw.full.on {
  background: #e8f5e9;
}

.f-sw.light.on {
  background: #fff3e0;
}

.f-sw-txt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  font-size: 14px;
  font-weight: 600;
  color: #8a8f99;
  transition: color 0.15s ease;
}

.f-sw.full.on .f-sw-txt {
  color: #2e7d32;
}

.f-sw.light.on .f-sw-txt {
  color: #e65100;
}

.f-sw-sub {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.85;
}

.f-sw-dot {
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background: #cfd0d4;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.f-sw-dot::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  transition: left 0.2s ease;
}

.f-sw-dot.on {
  background: #2e7d32;
}

.f-sw.light .f-sw-dot.on {
  background: #e65100;
}

.f-sw-dot.on::after {
  left: 18px;
}

/* 加油站 / 备注 */
.f-field {
  margin-top: 12px;
}

.f-field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #8a8f99;
  margin-bottom: 8px;
}

.f-input :deep(.el-input__wrapper) {
  border-radius: 10px;
}

.f-textarea :deep(.el-textarea__inner) {
  border-radius: 10px;
  background: #f6f8fc;
  box-shadow: none;
  border: none;
}

/* 保存 */
.sheet-save {
  width: 100%;
}
</style>
