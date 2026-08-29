<template>
  <div class="fuel">
    <!-- ===== 头部：标题 + 管理/加油 ===== -->
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
        <el-button type="primary" round class="fuel-add" :disabled="!vehicles.length" @click="goNew">
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
          <div class="fuel-card" @click="goEdit(r)">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus, Delete, Edit, Van, CircleCheck, Setting } from '@element-plus/icons-vue';
import { vehicleApi, fuelRecordApi } from '@/api';
import { usePrefsStore } from '@/stores/prefs';

const prefs = usePrefsStore();
const route = useRoute();
const router = useRouter();

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
const records = ref<any[]>([]);
const vehicles = ref<any[]>([]);
const filterVehicleId = ref('');

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

function goNew() {
  router.push('/fuel-records/new');
}

function goEdit(r: any) {
  router.push(`/fuel-records/${r.id}/edit`);
}

function goVehicles() {
  router.push('/vehicles');
}

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
  padding: 0 0 24px;
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

.fuel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.fuel-head :deep(.el-button--primary) {
  background: linear-gradient(135deg, #4a8cf7, #2e6be6);
  border: none;
  border-radius: 18px;
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
</style>
