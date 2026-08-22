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
        { path: 'items/:id', component: () => import('../views/ItemForm.vue'), meta: { title: '编辑记录' } },
        { path: 'books', component: () => import('../views/Books.vue'), meta: { title: '账本' } },
        { path: 'notes', component: () => import('../views/Notes.vue'), meta: { title: '记事' } },
        { path: 'notes/new', component: () => import('../views/NoteForm.vue'), meta: { title: '新建记事' } },
        { path: 'notes/:id', component: () => import('../views/NoteForm.vue'), meta: { title: '编辑记事' } },
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
