import axios from 'axios';

// Absolute API base (e.g. https://api.example.com/api) for split/cross-origin
// deploys; falls back to the relative '/api' path that nginx proxies in Docker.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      globalThis.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
