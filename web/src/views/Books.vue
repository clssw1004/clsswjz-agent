<template>
  <section class="glass page">
    <div class="toolbar">
      <h3>我的账本</h3>
      <el-button type="primary" @click="openCreate">新建账本</el-button>
    </div>

    <el-row :gutter="16">
      <el-col v-for="b in books" :key="b.id" :xs="24" :sm="12" :md="8" style="margin-bottom:16px">
        <el-card class="book-card glass" shadow="never">
          <div class="book-name">{{ b.name }}</div>
          <div class="book-currency">{{ b.currencySymbol }}</div>
          <div class="book-desc">{{ b.description || '暂无描述' }}</div>
          <div class="book-actions">
            <el-button size="small" @click="openEdit(b)">编辑</el-button>
            <el-popconfirm title="确定删除该账本？" @confirm="removeBook(b.id)">
              <template #reference>
                <el-button size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="!loading && books.length === 0" description="还没有账本，创建一个吧" />

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑账本' : '新建账本'" width="420px">
      <el-form label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="账本名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="货币符号">
          <el-select v-model="form.currencySymbol" style="width:100%">
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { bookApi } from '@/api';
import { useAppStore } from '@/stores/app';

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
.page { padding: 4px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.toolbar h3 { margin: 0; color: var(--text-1); }
.book-card { cursor: default; }
.book-name { font-size: 16px; font-weight: 600; color: var(--text-1); }
.book-currency { font-size: 22px; color: var(--brand-gold); font-weight: 700; margin: 6px 0; }
.book-desc { font-size: 13px; color: var(--text-3); min-height: 18px; }
.book-actions { margin-top: 12px; display: flex; gap: 8px; }
</style>
