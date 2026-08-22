import axios from 'axios';
import router from '../router';

const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('web_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body?.code === 0) return body.data;
    return body;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('web_token');
      localStorage.removeItem('web_nickname');
      router.push('/login');
    }
    const msg = err.response?.data?.message || err.message || '请求失败';
    ElMessage.error(msg);
    return Promise.reject(err);
  },
);

export default http;
