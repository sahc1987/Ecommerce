import {SERVER_URL} from '../config';

/**
 * Resolves an image URL coming from the API into something RN can load.
 *
 * When Cloudinary is configured the backend stores absolute https URLs, but the
 * local-disk fallback stores a relative path like `/uploads/<uuid>.png`. A
 * browser resolves that against the page origin; React Native has no origin, so
 * a relative URI silently fails to load. Prefix it with the API host.
 *
 * Also passes through `file://` and `content://` URIs unchanged so freshly
 * picked local images (image-picker) still preview correctly.
 */
export const mediaUrl = (url?: string | null): string | undefined => {
  if (!url) {
    return undefined;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url;
  }
  return `${SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};
