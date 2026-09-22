// Uploaded files are stored as either absolute (Cloudinary) or server-relative
// ("/uploads/x.png") URLs. Relative ones need the API origin when the app is
// served from a different host than the API (VITE_API_URL is absolute).
const apiBase = import.meta.env.VITE_API_URL || '/api';
const origin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : '';

export const mediaUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
};
