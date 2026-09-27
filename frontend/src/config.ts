// Absolute API base (e.g. https://api.example.com/api) for split/cross-origin
// deploys; falls back to the relative '/api' path that nginx proxies in Docker.
// An empty VITE_API_URL (e.g. a blank build arg) also means "use the default".
const resolveApiBase = (): string => {
  const url = import.meta.env.VITE_API_URL;
  if (url) return url;
  return '/api';
};

export const API_BASE = resolveApiBase();
