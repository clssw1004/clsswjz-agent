<template>
  <section class="page">
    <div class="toolbar">
      <div class="toolbar-title">
        <h3>我的账本</h3>
        <span class="count">{{ books.length }} 本</span>
      </div>
      <el-button type="primary" round @click="openCreate">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新建账本
      </el-button>
    </div>

    <el-row :gutter="16">
      <el-col v-for="(b, i) in books" :key="b.id" :xs="24" :sm="12" :md="8" style="margin-bottom:16px">
        <div class="book-card" :style="{ '--book-grad': cardGrad(i) }">
          <div class="book-cover">
            <span class="book-currency">{{ b.currencySymbol || '¥' }}</span>
            <span class="book-name">{{ b.name }}</span>
            <span class="book-desc">{{ b.description || '暂无描述' }}</span>
            <span v-if="b.id === app.currentBookId" class="book-current">当前</span>
          </div>
          <div class="book-actions">
            <el-button size="small" round @click="openEdit(b)">编辑</el-button>
            <el-popconfirm title="确定删除该账本？" @confirm="removeBook(b.id)">
              <template #reference>
                <el-button size="small" round type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-empty v-if="!loading && books.length === 0" description="还没有账本，创建一个吧">
      <el-button type="primary" round @click="openCreate">创建账本</el-button>
    </el-empty>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑账本' : '新建账本'" width="420px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="账本名称" size="large" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="（可选）" />
        </el-form-item>
        <el-form-item label="货币符号">
          <el-select v-model="form.currencySymbol" style="width:100%" size="large">
            <el-option label="¥ 人民币" value="¥" />
            <el-option label="$ 美元" value="$" />
            <el-option label="£ 英镑" value="£" />
            <el-option label="JPY¥ 日元" value="JPY¥" />
            <el-option label="HK$ 港币" value="HK$" />
            <el-option label="NT$ 新台币" value="NT$" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { bookApi } from '@/api';
import { useAppStore } from '@/stores/app';

const GRADS = [
  'linear-gradient(135deg, #14b8a6, #2dd4bf)',
  'linear-gradient(135deg, #6366f1, #818cf8)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #ec4899, #f472b6)',
  'linear-gradient(135deg, #06b6d4, #22d3ee)',
  'linear-gradient(135deg, #8b5cf6, #a78bfa)',
];

function cardGrad(i: number) {
  return GRADS[i % GRADS.length];
}

const app = useAppStore();
const books = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive({ name: '', description: '', currencySymbol: '¥' });

async function load() {
  loading.value = true;
  try {
    const res: any = await bookApi.list();
    books.value = Array.isArray(res) ? res : res?.items || [];
    app.books = books.value;
  } finally { loading.value = false; }
}

function openCreate() {
  editingId.value = '';
  Object.assign(form, { name: '', description: '', currencySymbol: '¥' });
  dialogVisible.value = true;
}

function openEdit(b: any) {
  editingId.value = b.id;
  Object.assign(form, { name: b.name, description: b.description || '', currencySymbol: b.currencySymbol || '¥' });
  dialogVisible.value = true;
}

async function save() {
  if (!form.name) return;
  saving.value = true;
  try {
    if (editingId.value) await bookApi.update(editingId.value, { ...form });
    else await bookApi.create({ ...form });
    dialogVisible.value = false;
    await load();
  } finally { saving.value = false; }
}

async function removeBook(id: string) {
  await bookApi.delete(id);
  if (app.currentBookId === id) app.switchBook('');
  await load();
}

onMounted(load);
</script>

<style scoped>
.page {
  padding: 0;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.toolbar h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-1);
}

.count {
  font-size: 13px;
  color: var(--text-3);
}

/* 账本卡片 */
.book-card {
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.book-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-float);
}

.book-cover {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px 20px;
  background: var(--book-grad);
  color: #fff;
  min-height: 128px;
  overflow: hidden;
}

.book-cover::after {
  content: '';
  position: absolute;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  top: -50px;
  right: -30px;
}

.book-currency {
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.book-name {
  font-size: 17px;
  font-weight: 700;
  position: relative;
}

.book-desc {
  font-size: 12px;
  opacity: 0.85;
  position: relative;
  min-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-current {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.book-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 14px;
}
</style>
