import axios, { type AxiosError } from 'axios';
import { getCartToken } from '../utils/cartToken';
import { API_BASE } from '../config';

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// Every request carries the cart token so stock holds follow this browser.
api.interceptors.request.use((config) => {
  config.headers.set('X-Cart-Token', getCartToken());
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      globalThis.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/** Pulls the server's `{ error }` message out of an axios failure. */
export const errorMessage = (err: unknown, fallback: string): string => {
  const serverError = (err as AxiosError<{ error?: string }> | undefined)?.response?.data?.error;
  if (serverError) return serverError;
  return fallback;
};

export default api;
