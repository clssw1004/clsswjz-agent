import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login },
    {
      path: '/',
      component: () => import('../views/Layout.vue'),
      redirect: '/items',
      children: [
        { path: 'items', component: () => import('../views/ItemsView.vue'), meta: { title: '记账' } },
        { path: 'items/new', component: () => import('../views/ItemForm.vue'), meta: { title: '新建记录' } },
        { path: 'items/list', component: () => import('../views/ItemList.vue'), meta: { title: '账目列表' } },
        { path: 'items/:id', component: () => import('../views/ItemForm.vue'), meta: { title: '编辑记录' } },
        { path: 'features', component: () => import('../views/Features.vue'), meta: { title: '功能' } },
        { path: 'statistics', component: () => import('../views/Statistics.vue'), meta: { title: '统计' } },
        { path: 'mine', component: () => import('../views/Mine.vue'), meta: { title: '我的' } },
        { path: 'books', component: () => import('../views/Books.vue'), meta: { title: '账本' } },
        { path: 'notes', component: () => import('../views/Notes.vue'), meta: { title: '记事' } },
        { path: 'notes/new', component: () => import('../views/NoteForm.vue'), meta: { title: '新建记事' } },
        { path: 'notes/:id', component: () => import('../views/NoteForm.vue'), meta: { title: '编辑记事' } },
        { path: 'settings/categories', component: () => import('../views/settings/Categories.vue'), meta: { title: '分类管理' } },
        { path: 'settings/shops', component: () => import('../views/settings/Shops.vue'), meta: { title: '商户管理' } },
        { path: 'settings/tags', component: () => import('../views/settings/Tags.vue'), meta: { title: '标签管理' } },
        { path: 'settings/projects', component: () => import('../views/settings/Projects.vue'), meta: { title: '项目管理' } },
        { path: 'settings/funds', component: () => import('../views/settings/Funds.vue'), meta: { title: '账户' } },
        { path: 'settings/sync', component: () => import('../views/settings/SyncSettings.vue'), meta: { title: '同步设置' } },
        { path: 'periods', component: () => import('../views/Periods.vue'), meta: { title: '经期记录' } },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (to.path !== '/login' && !localStorage.getItem('web_token')) {
    return '/login';
  }
});

export default router;
