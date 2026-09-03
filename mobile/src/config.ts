import {Platform} from 'react-native';

/**
 * Base URL for the Express API (the part before `/api`).
 *
 * The Android emulator reaches the host machine at 10.0.2.2, never localhost.
 * For a physical device over LAN, or a deployed backend, override this with
 * your machine's IP (e.g. 'http://192.168.1.42:5000') or the public URL.
 */
const DEV_HOST = Platform.select({
  android: 'http://10.0.2.2:5000',
  ios: 'http://localhost:5000',
  default: 'http://localhost:5000',
});

export const API_URL = `${DEV_HOST}/api`;

export const CURRENCY_FALLBACK = 'USD';
