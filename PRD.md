# Product Requirements Document: Ecommerce

Status: reflects the product as built. Source of truth for behavior is the code (`backend/src/utils/orderStatus.js`, `backend/src/routes/returns.js`, `backend/src/db/schema.sql`); where this document and the code disagree, the code wins.

## 1. Overview

A single-store online shop with a back office, available on web and as an iOS/Android app. One Express API serves both clients, so both follow the same business rules.

**Goals**

1. Let shoppers browse, hold stock in a cart, and pay by card (Stripe) or cash on delivery.
2. Let staff run the store: catalog, orders, shipping, returns, refunds.
3. Never oversell, never double-charge, never refund more than was paid.
4. Be deployable by one person with Docker, with no built-in secrets.

**Non-goals**

- Multi-vendor marketplaces or multiple stores per deployment.
- Shipping fees or carrier rate calculation (shipping is free on every order).
- Wishlists, chat, memberships, personalised recommendations, or any feature without a working backend.
- Payment methods beyond Stripe cards and cash on delivery.
- A migration runner (schema is applied idempotently on start).

## 2. Users and roles

| Role | Description | Capabilities |
| --- | --- | --- |
| Guest | Not signed in | Browse, search, hold items in a cart (via `X-Cart-Token`). Must sign in to order. |
| Customer | Registered shopper | Everything a guest can do, plus place orders, view and cancel own orders, request returns, receive notifications. |
| Staff | Store employee | Manage products and categories (not delete), process/ship/cancel orders, review returns and issue refunds, view dashboard. |
| Admin | Store owner | Everything staff can do, plus delete products and categories, manage users and roles, store setup and logo. |

The first registered user becomes `admin`; all later registrations are `customer`.

## 3. Functional requirements

### 3.1 Accounts and authentication

- FR-1.1 Users register and sign in with email and password. Emails are matched case-insensitively.
- FR-1.2 Passwords are stored only as bcrypt hashes.
- FR-1.3 Web sessions use an httpOnly JWT cookie valid 7 days. Mobile sessions use a Bearer token (returned when `X-Client: mobile` is sent) held in the device keychain, accessible only while unlocked and excluded from backups.
- FR-1.4 Login takes the same time whether or not the email exists, so it cannot be used to enumerate accounts.
- FR-1.5 Back-office routes require `admin` or `staff`; user management and store setup require `admin`.
- FR-1.6 Login is rate limited (10 attempts per 15 minutes).

### 3.2 Store setup

- FR-2.1 First run redirects to a setup wizard capturing store name, logo, currency, tax rate, return window (days), time zone, and optional contact details.
- FR-2.2 Store name, logo, tab title, and favicon always come from settings, never a hard-coded brand.
- FR-2.3 Contact details appear in the shop only when set.
- FR-2.4 Settings are fetched once per client (`/setup/status`) and refreshed after admin edits.

### 3.3 Catalog

- FR-3.1 Categories and subcategories organise products; staff create and edit, admins delete.
- FR-3.2 Products have name, description, base price, category, active flag, and up to 10 photos per upload with one marked primary.
- FR-3.3 Every product has at least one variant. Products can define options (for example Color, Size) and sell variants, each with its own SKU, stock, and optional price override. Stock and SKU live on variants only.
- FR-3.4 Shoppers can browse by category/subcategory, search, and sort by `new` (default) or `popular` (units sold in non-cancelled orders).
- FR-3.5 Home page shows Best Sellers and newest arrivals, in whole rows only.
- FR-3.6 Product photos always render in a neutral white frame, uncropped, lazy-loaded (priority for the main image), with a category-icon placeholder when missing or failing.
- FR-3.7 Product pages set their own title, description, and schema.org `Product` data. `robots.txt` excludes cart, checkout, account, and back-office pages; the 404 page is `noindex`.
- FR-3.8 Uploads are validated by file content, not name or extension.
- FR-3.9 Images are stored in Cloudinary when configured, otherwise on local disk (development only).

### 3.4 Cart and stock holds

- FR-4.1 Guests and customers can build a cart. Adding an item opens the cart drawer; products needing option choices open the product page instead.
- FR-4.2 Adding stock to a cart creates a 3-minute hold keyed by `X-Cart-Token`, renewed while the shopper is active and expired by a background job.
- FR-4.3 Held stock is unavailable to others. If only part of a cart can be held, the UI identifies short and sold-out lines.
- FR-4.4 Stock checks use row locks so two shoppers can never reserve the same last unit.
- FR-4.5 A visible countdown shows hold time remaining.

### 3.5 Checkout and payment

- FR-5.1 Checkout requires sign-in. Tax is added from store settings; shipping is free.
- FR-5.2 Cash on delivery is always offered. Card payment is offered only when `STRIPE_SECRET_KEY` is configured.
- FR-5.3 `POST /payments/place-order` honours an `Idempotency-Key` header (retained 24 hours); a repeated request returns the first result and never creates a second order.
- FR-5.4 Card orders are confirmed by signed Stripe webhook, by a check when the customer returns from Checkout, and by a background sweeper. Marking paid and cancelling unpaid are idempotent.
- FR-5.5 Unpaid card checkouts expire after 30 minutes and their stock is released.
- FR-5.6 Place-order is rate limited (10 per minute).

### 3.6 Orders

- FR-6.1 Order statuses: `pending → paid → processing → shipped → delivered`, or `cancelled`. Allowed transitions are defined solely in `orderStatus.js`; clients render only the actions the API returns (`allowed_next`, `can_cancel`).
- FR-6.2 Card orders become `paid` only via Stripe. COD orders are marked `paid` by staff.
- FR-6.3 `shipped` requires a carrier and tracking number; customers see a working tracking link.
- FR-6.4 `delivered` and `cancelled` are final.
- FR-6.5 Customers cancel their own orders while `pending` or `paid`. Staff cancel any order up to `processing`.
- FR-6.6 Cancellation restocks items and refunds in one transaction. A failed Stripe refund rolls back the whole cancellation. Cancelling an unpaid card order closes its Stripe checkout first.
- FR-6.7 Staff status changes may send `expected_status`; a mismatch returns 409 with the latest order so the client can merge it.
- FR-6.8 Payment status: `unpaid | paid | canceled | partially_refunded | refunded`.
- FR-6.9 Order lists are paginated and filterable; customers see only their own orders.

### 3.7 Returns and refunds

- FR-7.1 A customer may request one return per `delivered` order, within `return_window_days` of the order date, choosing items and quantities up to what was purchased.
- FR-7.2 Return statuses: `requested → approved | rejected | refunded`; `approved → refunded`. `rejected` and `refunded` are final.
- FR-7.3 Staff approve, reject, or refund (optionally approving and refunding in one step), setting the refund amount and whether returned items go back on sale. With no listed lines, the whole order is restocked.
- FR-7.4 Refunds are capped at `total - refunded_amount`. Card refunds go through Stripe with an idempotency key, called last before COMMIT so failure rolls everything back. COD refunds are bookkeeping only.
- FR-7.5 Every order shows the amount refunded; revenue is `total - refunded_amount`.

### 3.8 Notifications

- FR-8.1 Customers receive notifications for order, shipping, and return updates, with an unread count.
- FR-8.2 Users can mark one or all as read and delete notifications.
- FR-8.3 Staff are notified of events needing action. Notifications are created after the originating transaction commits.

### 3.9 Back office

- FR-9.1 Dashboard (staff/admin): revenue, orders, units sold, average order value, and new customers, each compared with the previous period; sales chart; top products; recent orders; low-stock and sold-out alerts; pending shipments.
- FR-9.2 Product management: create/edit products, options, and variants; upload, remove, and reorder primary photo.
- FR-9.3 Order management: filter, view detail, advance status, add tracking, cancel.
- FR-9.4 Returns management: review, approve, reject, refund.
- FR-9.5 User management (admin): list, change role, remove.
- FR-9.6 The back office is lazy-loaded so shoppers do not download it.

### 3.10 Clients

- FR-10.1 Web (React SPA) and mobile (React Native) mirror the same features and stay in sync when API responses change.
- FR-10.2 Money is formatted through shared helpers; order and return status colours come from shared helpers (one colour per status).
- FR-10.3 Status endpoints return the order without `items`; clients merge the response into the order they hold.

## 4. Non-functional requirements

### 4.1 Security

- Helmet headers; CORS restricted to `CLIENT_URL`.
- Stripe webhook verified by signature; mounted before `express.json()` for the raw body.
- Server refuses to start without `JWT_SECRET`; Docker refuses to start without `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`. No fallback defaults for secrets.
- 500 responses go through `safeErr` and never leak internals. UUID path params are validated before querying.
- API and DB ports are published on `127.0.0.1` only; `trust proxy 1` behind nginx so clients cannot spoof `X-Forwarded-For` to bypass rate limits.
- Containers run as non-root with `no-new-privileges` and health checks.

### 4.2 Data integrity

- Multi-step writes run in transactions with `SELECT … FOR UPDATE` locks; domain errors abort rather than commit partial work.
- `schema.sql` is the single idempotent source of truth; changes are appended there and mirrored in `src/db/migrations/` for reference.

### 4.3 Performance and caching

- Redis caches products (30 s TTL, since stock is live), categories, dashboard, and setup. Invalidation is O(1) via namespace generation bumps, never pattern scans.
- The API must function without Redis (uncached).
- List endpoints are paginated with clamped page/limit.

### 4.4 Accessibility and UX

- Text contrast 4.5:1; non-text control borders 3:1.
- One solid primary action per screen; rose only for sale/errors, green only for stock/success.
- Icon-only controls carry descriptive `aria-label`s; actions remain visible without hover; toggle chips set `aria-pressed`.
- Product grids are 2/3/4/5 columns (phone to wide).
- Shop copy only promises what the code does (free shipping, configured return window, COD always available).

### 4.5 Operability

- Docker Compose runs Postgres 16, Redis 7, the API, and the web (nginx-unprivileged on 8080) on Node 24 LTS.
- Background jobs: expire holds, settle Stripe payments.
- Graceful shutdown on SIGTERM/SIGINT: finish in-flight requests, close the DB pool.

## 5. Data model

Tables: `store_settings`, `users`, `categories`, `subcategories`, `products`, `product_images`, `product_options`, `product_variants`, `stock_reservations`, `orders`, `order_items`, `idempotency_keys`, `returns`, `return_items`, `notifications`, `legacy_product_stock_sku` (history).

Key constraints: one return per order (unique index); order lines reference `variant_id`; roles are `admin | staff | customer`.

## 6. API surface (summary)

All routes live under `/api`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /auth/me` |
| Setup | `GET /setup/status`; `POST /setup/complete`, `/setup/logo` (admin) |
| Catalog | `/categories`, `/categories/:id/subcategories`, `/products`, `/products/:idOrSlug`, admin product and image routes |
| Cart holds | `GET/PUT /reservations`, `POST /reservations/renew`, `DELETE /reservations/:id?` |
| Checkout | `POST /payments/place-order`, `GET /payments/config`, `/payments/return`, `POST /payments/:id/confirm|cancel`, `POST /payments/webhook` |
| Orders | `GET /orders`, `/orders/:id`; `POST /orders/:id/cancel`; `PUT /orders/:id/status` (staff) |
| Returns | `GET /returns`, `/returns/:id`; `POST /returns`; `PUT /returns/:id` (staff) |
| Dashboard | `/dashboard/summary`, `top-products`, `recent-orders`, `sales-chart`, `low-stock`, `pending-shipments` (staff) |
| Users | `/users` (admin) |
| Notifications | `GET /notifications`; `PUT /notifications/:id/read`, `/notifications/read-all`; `DELETE /notifications/:id` |
| Health | `GET /health` |

## 7. Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `JWT_SECRET` | Yes | Token signing |
| `CLIENT_URL` | Yes | Allowed web origin |
| `REDIS_URL` | Recommended | Caching |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional | Card payments |
| `CLOUDINARY_*` | Optional | Image hosting |
| `CROSS_SITE_COOKIES` | Optional | Web and API on different domains |
| `VITE_API_URL` | Optional | API base URL for the web app |

## 8. Success criteria

- No oversell under concurrent checkout of the last unit.
- Repeated place-order requests with one idempotency key yield exactly one order.
- Total refunds on an order never exceed its total.
- A failed Stripe refund leaves order and stock unchanged.
- Abandoned card checkouts release stock within 30 minutes.
- Web and mobile show the same allowed actions for any order or return.
- Backend unit and API tests, web Vitest, and mobile Jest suites pass; lint and typecheck are clean.

## 9. Open items

- No licence is published; all rights reserved by the author.
- Email delivery (receipts, shipping notices) is not implemented; notifications are in-app only.
- No password reset flow.
- Single currency and tax rate per store.
