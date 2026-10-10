# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three independent npm projects share one API; there is no root `package.json` or workspace.

- `backend/` — Express 4 API (plain CommonJS JavaScript, no build step, no test suite)
- `frontend/` — React 18 + Vite + TypeScript web app: storefront and back office in one SPA
- `mobile/` — React Native 0.87 app (iOS/Android): storefront and back office

## Commands

```bash
# Infrastructure (Postgres + Redis only; the backend/frontend containers are optional)
docker compose up -d postgres redis

# Backend (needs backend/.env with DATABASE_URL; Redis is optional, see Caching)
cd backend && npm run db:init     # applies src/db/schema.sql
cd backend && npm run dev         # nodemon, http://localhost:5000
node --check src/routes/orders.js # quickest syntax check; there is no lint/test script

# Web
cd frontend && npm run dev        # http://localhost:5173, proxies /api and /uploads to :5000
cd frontend && npx tsc --noEmit   # typecheck; `npm run build` = tsc + vite build

# Mobile
cd mobile && npm run android      # or: npm run ios
cd mobile && npx tsc --noEmit
cd mobile && npm run lint
cd mobile && npx jest path/to/file.test.tsx   # single test
```

In local dev, the root `.env` maps Postgres to host port **5433**, not 5432, to avoid a native PostgreSQL install. `backend/.env` points `DATABASE_URL` at that port.

The mobile Jest suite currently fails to load `react-redux` (a transform config issue), so `__tests__/App.test.tsx` does not run.

## Database and migrations

- `backend/src/db/schema.sql` is the single source of truth and **must stay idempotent**. `db:init` runs the whole file on every start (the backend container runs it before `node src/index.js`). Use `CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and guarded `DO $$` blocks.
- New schema changes are appended to the end of `schema.sql` **and** copied into a file in `src/db/migrations/` (for reference/manual runs; there is no migration runner).
- `IF NOT EXISTS` on an index skips silently when the *name* is already taken, even by a different kind of index. Use a new name when changing an index.
- Stock lives on `product_variants` (every product has at least a default variant with `options = '{}'`); `products` has no stock/SKU columns. Order lines reference `variant_id`.
- The first user to register becomes `admin`; later ones are `customer`.

## Backend architecture

`src/index.js` exits at startup if `JWT_SECRET` is unset, then mounts every router under `/api`. The Stripe webhook is mounted **before** `express.json()` because it needs the raw body.

**Auth** (`middleware/auth.js`): JWT read from the `token` httpOnly cookie (web) or `Authorization: Bearer` (mobile). Sending `X-Client: mobile` makes login/register return the token in the body. `requireRole('admin','staff')` guards back-office routes.

**Business rules live in `src/utils/`, not in the routes.** Routes validate input and shape responses:

- `orderStatus.js` is the only definition of which order status changes are allowed. Order responses include `allowed_next` (admin) and `can_cancel` (owner) so the clients render only valid actions. Never hard-code status lists in the apps.
- `orderCancel.js` handles every cancellation (customer `POST /orders/:id/cancel` and admin `PUT /orders/:id/status` → cancelled): restock + refund in one transaction.
- `refunds.js` handles all money going back. It caps refunds at `total - refunded_amount` and calls Stripe **last, before COMMIT**, with an idempotency key, so a failed refund rolls everything back. Cash-on-delivery refunds are bookkeeping only.
- `inventory.js` restocks (sums quantities per variant, since `UPDATE … FROM` applies one row per target).
- `stripeOrders.js` keeps card orders in sync with Stripe from three places: the webhook, the customer returning from Checkout (`refreshOrder`), and a background sweeper. `markPaid`/`cancelUnpaid` are idempotent and keyed on `payment_status = 'unpaid'`.
- `reservations.js` holds cart stock (3-minute holds keyed by the `X-Cart-Token` header, renewed while active, expired by a background job).

Conventions used across the routes:

- Multi-step writes use `const client = await db.connect()` with `BEGIN`/`COMMIT`/`ROLLBACK` and `SELECT … FOR UPDATE` row locks. Domain errors are thrown as small classes (`OrderConflict`, `RefundError`, `ReturnRejected`) carrying an HTTP status and mapped to responses in the route.
- Optimistic concurrency: admin status changes may send `expected_status`. A mismatch returns 409 with the fresh `order`, which the clients merge into their view.
- Request checks live in `utils/validate.js`. Use `pagination(req.query)` for every list endpoint (clamps page/limit). Validate UUID path params with `router.param('id', uuidParam('X not found'))`, or `isUuid()` inline, before querying; an invalid UUID would otherwise be a Postgres error → 500. Don't redefine `UUID_RE` locally.
- 500 responses go through `safeErr(err)` so internals don't leak.
- `POST /payments/place-order` honours an `Idempotency-Key` header (`middleware/idempotency.js`, stored 24h).

**Lifecycles** (the README's diagrams are older than the code; trust `orderStatus.js` and `routes/returns.js`):

- Order: `pending → paid → processing → shipped → delivered`. A COD order is marked `paid` by staff; a card order only becomes `paid` via Stripe. Cancellation is allowed from pending/paid/processing (customers only while pending/paid). `shipped` requires a tracking number. Delivered/cancelled are final.
- Return: only for `delivered` orders, one per order (unique index), within `store_settings.return_window_days` of the order date. `requested → approved | rejected | refunded`, `approved → refunded`. Refunding optionally restocks the returned lines (or the whole order if the request listed no lines).
- `payment_status`: `unpaid | paid | canceled | partially_refunded | refunded`. Dashboard revenue is `total - refunded_amount`.

**Caching** (`utils/cache.js`): Redis-backed, but every call swallows errors, so the API runs without Redis (you'll see `Redis error (non-fatal)` logs). After a write, invalidate what changed: `cache.invalidateProducts(...ids/slugs)` for stock or catalog changes, `cache.invalidateDashboard()` for anything affecting orders/revenue. Do this after COMMIT.

**Notifications**: `utils/notifications.js` (`createNotification` for a user, `notifyAdmins` for staff), sent after the transaction commits.

## Clients

Both apps mirror the same features and should stay in sync when an API response changes.

- **Web** (`frontend/src`): axios instance in `api/index.ts` with `withCredentials` (cookie auth), the `X-Cart-Token` header, a 401 → `/login` redirect, and `errorMessage(err, fallback)` for toasts. Several pages serve both roles via an `isCustomer` prop (e.g. `pages/Admin/Orders/OrderDetail.tsx`). Redux Toolkit holds cart/auth; Tailwind for styling.
- **Mobile** (`mobile/src`): typed endpoint wrappers in `api/index.ts` over `api/client.ts` (Bearer token from the keychain, `X-Client: mobile`). Shared API types are in `types.ts`. The backend address is chosen by `MODE` in `src/config.ts` (the default `reverse` needs `adb reverse tcp:5000 tcp:5000` on Android; no npm script runs it, despite the comment in `config.ts`).
- Status endpoints return the order **without** `items`. Clients merge the response into the order they already hold rather than replacing it.

## Docker

- `DB_PASSWORD`, `REDIS_PASSWORD` and `JWT_SECRET` use `${VAR:?…}` in `docker-compose.yml`: compose refuses to start without them. Never add fallback defaults for secrets.
- The API sets `trust proxy 1` (nginx), so the backend and Postgres ports are published on `127.0.0.1` only. Publishing the backend on all interfaces would let clients spoof `X-Forwarded-For` and bypass rate limits.
- The web image is `nginxinc/nginx-unprivileged` listening on **8080** (non-root can't bind 80). Health checks use busybox `wget`, since the images don't include `curl`.
- Images use Node 24 LTS. Install production deps with `npm ci --omit=dev`.

## Payments

Stripe is optional: with `STRIPE_SECRET_KEY` empty, only cash on delivery is offered and card refunds can't run. Locally, `stripe listen --forward-to localhost:5000/api/payments/webhook` provides `STRIPE_WEBHOOK_SECRET`; test card `4242 4242 4242 4242`.
