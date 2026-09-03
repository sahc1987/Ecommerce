import axios, {AxiosError} from 'axios';
import {API_URL} from '../config';
import {loadToken} from '../utils/storage';

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  // `X-Client: mobile` makes the backend return the JWT in the login/register
  // response body instead of relying on an httpOnly cookie the app cannot read.
  headers: {'X-Client': 'mobile'},
});

let token: string | null = null;

export const setAuthToken = (value: string | null) => {
  token = value;
};

/** Rehydrates the in-memory token from the keychain on cold start. */
export const restoreAuthToken = async () => {
  token = await loadToken();
  return token;
};

let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

api.interceptors.request.use(config => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(err);
  },
);

/** Pulls the server's `{ error }` message out of an axios failure. */
export const errorMessage = (err: unknown, fallback = 'Something went wrong') => {
  const axiosErr = err as AxiosError<{error?: string}>;
  if (axiosErr?.response?.data?.error) {
    return axiosErr.response.data.error;
  }
  if (axiosErr?.message === 'Network Error') {
    return 'Cannot reach the server. Check API_URL in src/config.ts.';
  }
  return axiosErr?.message || fallback;
};

export default api;
