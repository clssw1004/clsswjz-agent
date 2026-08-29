<template>
  <div class="frf">
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

    <!-- ===== 底部固定保存 ===== -->
    <div class="frf-savebar">
      <el-button type="primary" round size="large" class="frf-save" :loading="saving" @click="save">
        <el-icon style="margin-right: 4px"><Check /></el-icon>保存
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Check } from '@element-plus/icons-vue';
import { vehicleApi, fuelRecordApi } from '@/api';

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

const saving = ref(false);
const vehicles = ref<any[]>([]);
const editId = ref('');

const activeVehicles = computed(() => vehicles.value.filter((v) => v.isActive));

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

async function loadRecord(id: string) {
  try {
    const res: any = await fuelRecordApi.get(id);
    const r = res?.data ?? res;
    if (r) {
      Object.assign(form, {
        id: r.id, vehicleId: r.vehicleId, refuelTime: r.refuelTime || Date.now(),
        mileage: Number(r.mileage || 0), energyType: r.energyType || 'GASOLINE',
        fuelGrade: r.fuelGrade || '92#', volume: Number(r.volume || 0),
        unitPrice: Number(r.unitPrice || 0), totalAmount: Number(r.totalAmount || 0),
        isFullTankOn: !!r.isFullTank, isFuelLightOn: !!r.isFuelLightOn,
        station: r.station || '', remark: r.remark || '',
      });
    }
  } catch { /* ignore */ }
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
    window.history.back();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadVehicles();
  // 编辑：/fuel-records/:id/edit；新建：/fuel-records/new
  const seg = route.params.id;
  if (seg && typeof seg === 'string') {
    editId.value = seg;
    await loadRecord(seg);
    form.vehicleId = form.vehicleId || activeVehicles.value[0]?.id || '';
  } else {
    form.vehicleId = activeVehicles.value[0]?.id || '';
  }
});
</script>

<style scoped>
.frf {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 0 24px;
}

/* ===== 底部固定保存 ===== */
.frf-savebar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(246, 247, 249, 0), rgba(246, 247, 249, 0.92) 40%, #f6f7f9);
}

.frf-save {
  width: 100%;
  height: 46px;
  border-radius: 23px;
  background: linear-gradient(135deg, #4a8cf7, #2e6be6) !important;
  border: none !important;
  color: #ffffff !important;
  font-size: 15px;
  font-weight: 600;
}

.frf-save:hover,
.frf-save:focus {
  background: linear-gradient(135deg, #5a9aff, #3a7bf0) !important;
  color: #ffffff !important;
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
</style>
