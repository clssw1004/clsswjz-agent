import http from './http';

export const authApi = {
  login: (data: { mainServerUrl: string; username: string; password: string }) =>
    http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
};

export const itemApi = {
  list: (params: any) => http.get('/items', { params }),
  get: (id: string) => http.get(`/items/${id}`),
  create: (data: any) => http.post('/items', data),
  update: (id: string, data: any) => http.put(`/items/${id}`, data),
  delete: (id: string) => http.delete(`/items/${id}`),
  summary: (params: any) => http.get('/items/summary', { params }),
  statistics: (params: any) => http.get('/items/statistics', { params }),
};

export const bookApi = {
  list: (params?: any) => http.get('/books', { params }),
  create: (data: any) => http.post('/books', data),
  update: (id: string, data: any) => http.put(`/books/${id}`, data),
  delete: (id: string) => http.delete(`/books/${id}`),
};

export const categoryApi = {
  list: (params?: any) => http.get('/categories', { params }),
  create: (data: any) => http.post('/categories', data),
  update: (id: string, data: any) => http.put(`/categories/${id}`, data),
  delete: (id: string) => http.delete(`/categories/${id}`),
};

export const fundApi = {
  list: (params?: any) => http.get('/funds', { params }),
};

export const shopApi = {
  list: (params?: any) => http.get('/shops', { params }),
  create: (data: any) => http.post('/shops', data),
  update: (id: string, data: any) => http.put(`/shops/${id}`, data),
  delete: (id: string) => http.delete(`/shops/${id}`),
};

export const tagApi = {
  list: (params?: any) => http.get('/tags', { params }),
  create: (data: any) => http.post('/tags', data),
  update: (id: string, data: any) => http.put(`/tags/${id}`, data),
  delete: (id: string) => http.delete(`/tags/${id}`),
};

export const projectApi = {
  list: (params?: any) => http.get('/projects', { params }),
  create: (data: any) => http.post('/projects', data),
  update: (id: string, data: any) => http.put(`/projects/${id}`, data),
  delete: (id: string) => http.delete(`/projects/${id}`),
};

export const noteApi = {
  list: (params?: any) => http.get('/notes', { params }),
  get: (id: string) => http.get(`/notes/${id}`),
  create: (data: any) => http.post('/notes', data),
  update: (id: string, data: any) => http.put(`/notes/${id}`, data),
  delete: (id: string) => http.delete(`/notes/${id}`),
};

export const attachmentApi = {
  list: (params?: any) => http.get('/attachments', { params }),
  upload: (file: File, businessCode: string, businessId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('businessCode', businessCode);
    formData.append('businessId', businessId);
    return http.post('/attachments/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: (id: string) => `/api/attachments/${id}`,
  remove: (id: string) => http.delete(`/attachments/${id}`),
};

export const syncApi = {
  push: () => http.post('/sync/push'),
  pull: (data?: any) => http.post('/sync/pull', data),
  run: () => http.post('/sync/run'),
  reset: () => http.post('/sync/reset'),
  status: () => http.get('/sync/status'),
};
