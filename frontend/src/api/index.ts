import axios from 'axios';
import { getCartToken } from '../utils/cartToken';

// Absolute API base (e.g. https://api.example.com/api) for split/cross-origin
// deploys; falls back to the relative '/api' path that nginx proxies in Docker.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true });

// Every request carries the cart token so stock holds follow this browser.
api.interceptors.request.use((config) => {
  config.headers.set('X-Cart-Token', getCartToken());
  return config;
});

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
