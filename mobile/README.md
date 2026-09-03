# Ecommerce Mobile

React Native (bare CLI) client for the Express/Postgres backend in `../backend`.
Covers the full customer storefront **and** the admin console.

- **RN 0.87.1 / React 19.2.3**, TypeScript
- **Redux Toolkit** for auth, cart and store settings — mirrors `../frontend/src/store`
- **React Navigation** (bottom tabs + native stacks)
- **Auth via Bearer token** kept in the OS keychain (see below)

## Prerequisites

This machine is missing two things needed for an Android build:

| Requirement | Status | Fix |
|---|---|---|
| JDK 17 | Java 26 installed — RN's Gradle plugin does not support it | Install Temurin JDK 17 and point `JAVA_HOME` at it |
| Android SDK | `ANDROID_HOME` unset | Install Android Studio, then set `ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk` and add `platform-tools` to `PATH` |

Everything else (`npm install`, TypeScript, Metro bundling) already works and is verified.

## Running

```bash
# 1. Start the backend (from the repo root)
cd backend && npm run dev          # http://localhost:5000

# 2. Start Metro
cd mobile && npm start

# 3. Build and install on an emulator or attached device
npm run android
```

## Pointing the app at your API

The API base URL lives in [`src/config.ts`](src/config.ts). It defaults to the
Android emulator's host alias:

| Target | Value |
|---|---|
| Android emulator | `http://10.0.2.2:5000` (default) |
| Physical device on your LAN | `http://<your-machine-ip>:5000` |
| Deployed backend | `https://api.example.com` |

Cleartext HTTP is already permitted in debug builds via the manifest's
`usesCleartextTraffic` placeholder, so plain `http://` works during development.

## Auth: how mobile differs from web

The backend originally issued the JWT **only** as an httpOnly cookie, which React
Native cannot reliably store. Two additive backend changes support the app —
neither alters web behaviour:

1. [`backend/src/middleware/auth.js`](../backend/src/middleware/auth.js) now
   accepts `Authorization: Bearer <token>` as a fallback when no cookie is present.
2. [`backend/src/routes/auth.js`](../backend/src/routes/auth.js) also returns the
   token in the login/register response body — but **only** when the request
   carries `X-Client: mobile`. The web app never sends that header, so it keeps
   receiving the cookie-only response it always did.

The app sends that header on every request ([`src/api/client.ts`](src/api/client.ts))
and stores the token with `react-native-keychain`, not AsyncStorage. A 401 from any
endpoint clears the token and drops the user back to the login screen.

## What's in the app

**Storefront** — catalogue with debounced search, category and deals filters,
infinite scroll; product detail with an image gallery and stock-aware quantity
stepper; a cart persisted to AsyncStorage across restarts; checkout matching the
web app's address shape; order history and detail with tracking; return requests
inside the store's return window; a notification inbox with an unread tab badge.

**Admin** (tab appears only for `admin`/`staff`) — dashboard with KPI tiles, a
30-day revenue chart, recent orders and top sellers; product CRUD with multi-image
upload, primary-image selection and discount controls; categories and subcategories;
order management with status updates and carrier/tracking entry; return review with
refund amounts; customer management; store settings. Destructive actions
(`DELETE`) are hidden from `staff`, matching the backend's `requireRole('admin')`.

## Notes and known gaps

- **Pricing.** [`src/utils/format.ts`](src/utils/format.ts) reimplements the
  server's discount-window logic from `payments.js` so the cart preview matches
  what the server charges. The server remains the authority — checkout totals are
  labelled as estimates.
- **Notifications** are polled (60s and on foreground), because the backend has no
  push channel. Real push would need FCM plus a device-token table.
- **Product discount scheduling** (`discount_start` / `discount_end`) is read and
  respected but not editable in the app; use the web admin to set a schedule.
- **Setup wizard** is not ported — a store must be configured once from the web
  app before the mobile app shows currency and return-window values.
- 23 `no-void` ESLint warnings remain from the RN template's config; they flag the
  deliberate `void promise` fire-and-forget idiom. No errors.

## Verification performed

```bash
npx tsc --noEmit    # clean
npx eslint . --ext .ts,.tsx   # 0 errors
npx react-native bundle --platform android --dev false ...   # bundles successfully
```

The app has **not** been run on a device or emulator — that needs the JDK 17 and
Android SDK setup described above.
