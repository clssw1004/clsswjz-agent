import http from './http';

export const authApi = {
  login: (data: { mainServerUrl: string; username: string; password: string }) =>
    http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
  checkHost: (data: { mainServerUrl: string }) =>
    http.post('/auth/check-host', data),
};

export const userApi = {
  profile: () => http.get('/user/profile'),
  updateProfile: (data: { nickname?: string; email?: string; phone?: string; timezone?: string; language?: string }) =>
    http.put('/user/profile', data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.post('/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const userPrefApi = {
  get: () => http.get('/user/preferences'),
  update: (data: Record<string, any>) => http.put('/user/preferences', data),
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
  create: (data: any) => http.post('/funds', data),
  update: (id: string, data: any) => http.put(`/funds/${id}`, data),
  delete: (id: string) => http.delete(`/funds/${id}`),
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

export const periodApi = {
  listCycles: (params?: any) => http.get('/periods/cycles', { params }),
  createCycle: (data: any) => http.post('/periods/cycles', data),
  updateCycleEnd: (id: string, endDate: string) => http.patch(`/periods/cycles/${id}/end`, { endDate }),
  deleteCycle: (id: string) => http.delete(`/periods/cycles/${id}`),
  listDailyRecords: (cycleId: string) => http.get(`/periods/cycles/${cycleId}/records`),
  upsertDailyRecord: (cycleId: string, date: string, data: any) => http.put(`/periods/cycles/${cycleId}/records/${date}`, data),
  deleteDailyRecord: (cycleId: string, date: string) => http.delete(`/periods/cycles/${cycleId}/records/${date}`),
};

export const userShareApi = {
  list: () => http.get('/user-shares'),
  eligibleUsers: () => http.get('/user-shares/eligible-users'),
  setShare: (data: { targetUserId: string; businessType: string; isEnabled: boolean }) =>
    http.put('/user-shares', data),
  removeTarget: (targetUserId: string) => http.delete(`/user-shares/${targetUserId}`),
};

export const dbViewerApi = {
  tables: () => http.get('/db-viewer/tables'),
  tableData: (name: string, params?: { page?: number; pageSize?: number }) =>
    http.get(`/db-viewer/tables/${encodeURIComponent(name)}`, { params }),
  query: (sql: string, pageSize?: number) =>
    http.post('/db-viewer/query', { sql, pageSize }),
};

export const activityDefApi = {
  list: (params?: any) => http.get('/activity-defs', { params }),
  create: (data: any) => http.post('/activity-defs', data),
  update: (id: string, data: any) => http.put(`/activity-defs/${id}`, data),
  delete: (id: string) => http.delete(`/activity-defs/${id}`),
};

export const activityRecordApi = {
  list: (params?: any) => http.get('/activity-records', { params }),
  create: (data: any) => http.post('/activity-records', data),
  delete: (id: string) => http.delete(`/activity-records/${id}`),
};

export const vehicleApi = {
  list: () => http.get('/vehicles'),
  create: (data: any) => http.post('/vehicles', data),
  update: (id: string, data: any) => http.put(`/vehicles/${id}`, data),
  delete: (id: string) => http.delete(`/vehicles/${id}`),
};

export const fuelRecordApi = {
  list: (params?: any) => http.get('/fuel-records', { params }),
  create: (data: any) => http.post('/fuel-records', data),
  update: (id: string, data: any) => http.put(`/fuel-records/${id}`, data),
  delete: (id: string) => http.delete(`/fuel-records/${id}`),
};
