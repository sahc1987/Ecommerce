import {Platform} from 'react-native';

/**
 * Base URL for the Express API (the part before `/api`).
 *
 * Android has no route to the host's "localhost" on its own, so pick the mode
 * that matches how you are running:
 *
 *   'reverse'  — USB device or emulator with `adb reverse tcp:5000 tcp:5000`
 *                running. The phone's localhost:5000 is tunnelled to this
 *                machine. Works regardless of Wi-Fi. `npm run android` sets
 *                this up via the predevice script.
 *   'emulator' — Android emulator with no adb reverse; 10.0.2.2 is the
 *                emulator's alias for the host machine.
 *   'lan'      — Device on the same Wi-Fi as this machine, reaching it by IP.
 *                Requires the backend to listen on 0.0.0.0, not just localhost.
 *   'remote'   — A deployed backend.
 */
type Mode = 'reverse' | 'emulator' | 'lan' | 'remote';

const MODE: Mode = 'reverse';

/** This machine's LAN IP, used only when MODE is 'lan'. */
const LAN_IP = '10.0.0.130';

/** Public API origin, used only when MODE is 'remote'. */
const REMOTE_ORIGIN = 'https://api.example.com';

const ANDROID_HOST: Record<Mode, string> = {
  reverse: 'http://localhost:5000',
  emulator: 'http://10.0.2.2:5000',
  lan: `http://${LAN_IP}:5000`,
  remote: REMOTE_ORIGIN,
};

// iOS reaches the host directly, so only a remote backend changes the origin.
const IOS_HOST: Record<Mode, string> = {
  reverse: 'http://localhost:5000',
  emulator: 'http://localhost:5000',
  lan: `http://${LAN_IP}:5000`,
  remote: REMOTE_ORIGIN,
};

const DEV_HOST = Platform.select({
  android: ANDROID_HOST[MODE],
  ios: IOS_HOST[MODE],
  default: 'http://localhost:5000',
});

/** Origin only, no /api suffix — used to resolve relative upload paths. */
export const SERVER_URL = DEV_HOST;

export const API_URL = `${DEV_HOST}/api`;

export const CURRENCY_FALLBACK = 'USD';
