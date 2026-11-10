# Code Style

Conventions for all three projects. Tooling enforces some of this (ESLint, `tsc`); the rest is habit. When in doubt, match the surrounding file. For architecture see [ARCHITECTURE.md](ARCHITECTURE.md), for visual rules [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), for rules aimed at Claude Code [CLAUDE.md](CLAUDE.md).

## 1. General principles

- **Simplest thing that works.** No speculative abstractions, options, or placeholder features. Three similar lines beat a premature helper.
- **Follow the stack's current best practices** for whatever you touch (Express 4, React 18, Tailwind 4, React Native 0.87, PostgreSQL 16).
- **Business rules live in the backend** (`backend/src/utils/`). Clients render what the API allows (`allowed_next`, `can_cancel`) and never hard-code status lists.
- **Reuse before writing.** Check the shared helpers listed below first; don't redefine them locally.
- **Comments explain why, not what.** Name the constraint, race or business rule that isn't obvious from the code.
- **Keep diffs focused.** Don't reformat or refactor unrelated code in the same change.
- **Update the README** when behavior, endpoints, schema, setup or env vars change.

## 2. Backend (`backend/`)

Plain CommonJS JavaScript, no build step.

### Structure
- `routes/` validate input, call helpers, shape responses. `utils/` holds business rules. `middleware/` holds auth and idempotency.
- One router per resource; `src/app.js` mounts them under `/api`.
- Requires at the top: `express` and `db` first, then middleware, then `utils`.

### Formatting
- 2-space indent, semicolons, single quotes, `const` by default, `async/await` (no `.then` chains).
- SQL is always parameterised (`$1, $2`). Never interpolate user input into SQL.

### Conventions
- **Transactions:** multi-step writes use `withTransaction(async (client) => …)` with `SELECT … FOR UPDATE`. To refuse mid-transaction, throw a small domain error (`OrderConflict`, `RefundError`, …) carrying an HTTP status and map it in the route. Never COMMIT a half-done write.
- **Lists:** build WHERE with `Filters` and fetch with `paginate(...)`; always use `pagination(req.query)`.
- **IDs:** validate path params with `router.param('id', uuidParam('X not found'))` or `isUuid()` before querying. Don't redefine `UUID_RE`.
- **Auth:** `requireRole(...)`, `requireStaff`, `isStaff(user)`. Don't inline `['admin','staff'].includes(...)`.
- **Errors:** 500 responses go through `safeErr(err)` so internals don't leak. Return `{ error: '…' }` with the right status (400 bad input, 404 missing, 409 conflict).
- **Settings, ids, money:** `getStoreSettings()`, `shortId(id)`, `formatMoney`.
- **After a write** (after COMMIT): invalidate the right cache (`invalidateProducts`, `invalidateDashboard`, …), then send notifications.
- **Secrets** come from environment variables. Never add fallback defaults for them.

### Database
- Schema changes are appended to `schema.sql` **and** copied to `src/db/migrations/`, and must stay idempotent. See [DATABASE.md](DATABASE.md).

### Tests
- `node:test` with `node:assert`. Files named `*.test.js`.
- `test/unit/` for business rules (no DB, fake clients from `fakes.js`); `test/api/` for HTTP tests against a `*test*` database.
- Test behaviour and rules, not implementation details.

## 3. Web (`frontend/`)

React 18, Vite, TypeScript (`strict`), Tailwind 4, React Router 7, Redux Toolkit.

### TypeScript
- No `any`. Narrow caught errors with `isAxiosError`; use `errorMessage(err, fallback)` for toasts.
- API response types live in `types.ts` and `utils/pricing.ts`. Keep them in step with `mobile/src/types.ts`.
- Prefer `type`/`interface` for shapes, `unknown` plus narrowing for untrusted data.

### React
- Function components and hooks only. Name components `PascalCase.tsx`, hooks `useThing.ts`, helpers `camelCase.ts`.
- **Component files export only components** (React Fast Refresh). Put shared helpers in plain modules (`utils/`, `*Drafts.ts`).
- **Load data with `useApiGet`**, not `fetchX()` inside `useEffect`. An effect that must fetch itself uses an `ignore` flag in its cleanup.
- Obey the `react-hooks` lint rules: no synchronous `setState` in effects, no ref writes during render.
- Store settings come from `useStoreSettings`; never fetch `/setup/status` in a component.
- Add to cart through `useAddToCart`; open the drawer with `openCart(...)`.
- New admin pages are `React.lazy` routes.
- Redux Toolkit slices in `store/slices/`; keep component-local state in the component.

### Shared helpers (don't hand-roll)
| Need | Use |
| --- | --- |
| Price display | `formatPrice` in `utils/pricing.ts` (never `'$' + toFixed(2)`) |
| Cart totals | `cartTotals` |
| Order/return status colours and labels | `orderBadge`, `returnBadge`, `orderBar`, `shortId` in `utils/orderDisplay.ts` |
| Product photo | `components/Shop/ProductImage.tsx` (never a bare `<img>`) |
| Pagination | `components/Pagination.tsx` |
| Modals | `components/Modal.tsx` (native `<dialog>`) |
| Page title | `useDocumentTitle` |

### Styling
- Tailwind utility classes; theme tokens and `btn-*`, `input`, `card`, `badge` utilities are defined in `src/index.css`. There is no `tailwind.config.js`.
- Colour and contrast rules are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) and the header of `index.css`. In short: one solid `primary-600` action per screen, `slate-500` minimum for small text, never `slate-400` for text.
- Class order: layout → spacing → typography → colour → state (`hover:`, `focus-visible:`).

### Accessibility
- Icon-only buttons and links need an `aria-label` naming their target (`Delete ${p.name}`).
- Toggle and filter chips set `aria-pressed`.
- Actions must be visible without hover; everything works by keyboard and touch.
- Use semantic elements (`button`, `a`, `dialog`, `label`) before ARIA.

### Copy
- Only promise what the code does (free shipping, `return_window_days`, cash on delivery always offered).
- Store name, logo and contact details come from Store Settings, never hard-coded.

### Tooling
```bash
cd frontend && npm run lint && npm run typecheck && npm test
```
Tests use Vitest + Testing Library, co-located as `*.test.ts(x)` next to the code.

## 4. Mobile (`mobile/`)

React Native 0.87, TypeScript, React Navigation, Redux Toolkit.

- **Formatting** (Prettier config): single quotes, trailing commas everywhere, `arrowParens: 'avoid'`. The existing code is **not** fully Prettier-formatted (it uses no spaces inside braces), so **do not run `prettier --write` on existing files**. Match the surrounding style.
- Endpoint wrappers live in `src/api/index.ts` over `api/client.ts`; shared types in `src/types.ts`.
- Colours and spacing come from `src/theme`, which mirrors the web values. No hard-coded hex in screens.
- Product photos go through `components/ProductImage.tsx`.
- `void promise()` is allowed as a deliberate fire-and-forget statement.
- Tests: Jest in `__tests__/`. Add new native or ESM-only dependencies to `transformIgnorePatterns` and `jest.setup.js` when the suite breaks.

```bash
cd mobile && npx tsc --noEmit && npm run lint && npm test
```

## 5. Naming

| Thing | Style | Example |
| --- | --- | --- |
| JS/TS variables, functions | `camelCase` | `getStoreSettings` |
| React components, types, interfaces | `PascalCase` | `OrderDetail`, `Product` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETURN_LINES` |
| Backend files | `camelCase.js` | `orderStatus.js` |
| DB tables and columns | `snake_case`, plural tables | `order_items.variant_id` |
| JSON API fields | `snake_case` (as the DB returns them) | `allowed_next`, `can_cancel` |
| Indexes | `idx_<table>_<columns>` | `idx_orders_user_id` |
| Commits | conventional prefix, imperative | `feat: add return restock option` |

## 6. Git

- Small, focused commits with a `feat:` / `fix:` / `docs:` / `refactor:` / `test:` prefix.
- Run lint, typecheck and tests for the parts you changed before committing.
- Never commit `.env` files or secrets.
