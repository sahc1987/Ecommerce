# Testing

How to run and write tests in each project. For code conventions see [CODE_STYLE.md](CODE_STYLE.md); for the system under test see [ARCHITECTURE.md](ARCHITECTURE.md) and [DATABASE.md](DATABASE.md).

## 1. Overview

| Project | Runner | Kinds of tests | Location |
| --- | --- | --- | --- |
| `backend/` | Node's built-in `node:test` | unit (no DB) and API (real Postgres) | `test/unit/`, `test/api/` |
| `frontend/` | Vitest + jsdom + Testing Library | hooks, components, utils | co-located `*.test.ts(x)` |
| `mobile/` | Jest (React Native preset) | slices, utils, components | `__tests__/` |

There is no root `package.json`: run each command from inside its project folder. No CI workflow is checked in, so run the checks yourself before committing.

## 2. Commands

```bash
# Backend
cd backend && npm run test:unit        # business rules, no database needed
cd backend && npm test                 # unit + API (API tests skipped without TEST_DATABASE_URL)
cd backend && node --test test/api/orders.test.js   # one file

# Web
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test                # vitest run
cd frontend && npx vitest run src/hooks/useApiGet.test.ts   # one file

# Mobile
cd mobile && npx tsc --noEmit
cd mobile && npm run lint
cd mobile && npm test                  # jest
cd mobile && npx jest __tests__/cartSlice.test.ts           # one file
```

Before committing, run the checks for every project you changed. The `test-runner` agent (`.claude/agents/test-runner.md`) does this and reports only failures.

## 3. Backend

### 3.1 Unit tests (`test/unit/`)

- Cover business rules in `src/utils/`: order status transitions, refunds, variants, validation, shared helpers, uploads.
- Need no database. `fakes.js` provides:
  - `stubModule(path, exports)` replaces a module in `require.cache`, so code under test gets a fake pool or Redis.
  - `fakeClient(respond)` records SQL (whitespace-normalised) and params, and answers from `respond(sql, params)`.
  - `fakeRedis()` is an in-memory Redis; its `down` flag makes every call fail, to prove the API runs without Redis.
- Stripe is never called. Card refunds are tested with a fake Stripe client, because card payments are off in API tests.

### 3.2 API tests (`test/api/`)

Real Express app, real Postgres, real HTTP via `fetch`.

**Setup**

```bash
docker compose up -d postgres redis
# create an empty database whose name contains "test", e.g. ecommerce_test
export TEST_DATABASE_URL=postgresql://<user>:<pass>@localhost:5433/ecommerce_test
cd backend && npm test
```

Locally Postgres is on host port **5433**, not 5432.

**What the harness does** (`test/api/helpers.js`)

- Without `TEST_DATABASE_URL`, API tests are **skipped**, not failed.
- It refuses any database whose name does not contain `test`.
- On every run it **drops and recreates the `public` schema** of that database, applies `schema.sql`, seeds one admin (so test registrations become customers) and a `store_settings` row, then starts the app on a random port.
- It deletes `STRIPE_SECRET_KEY` (no real payments) and points `REDIS_URL` at a dead port (no cache, so a shared Redis can't leak another database's data).
- Files run one at a time (`--test-concurrency=1`) because they share the database.

**Helpers**

| Helper | Purpose |
| --- | --- |
| `start()` / `stop()` | call from `before` / `after` |
| `call(token, method, url, body)` | HTTP request returning `{ status, data }`; sends `X-Client: mobile` so login returns a token |
| `register(name, role?)` | creates a user (optionally promoted to `admin` / `staff`) and returns `{ token, id }` |
| `createProduct({ price, stock })` | product with one default variant |
| `stockOf(variantId)` | current stock |
| `query(...)` | direct SQL for assertions |
| `skip` | pass as `{ skip: h.skip }` to `describe` |

**Skeleton**

```js
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('feature', { skip: h.skip }, () => {
  before(h.start);
  after(h.stop);

  test('does the thing', async () => {
    const user = await h.register('alice');
    const r = await h.call(user.token, 'GET', '/orders');
    assert.equal(r.status, 200);
  });
});
```

Current API files: `auth`, `checkout`, `orders` (lifecycle, cancellation, returns, refunds), `products`, `validation`.

## 4. Web (`frontend/`)

- Vitest with `jsdom` and Testing Library, configured in `vite.config.ts`; setup in `src/test-setup.ts`.
- Vitest runs **without globals**: import `describe`, `it`, `expect`, `vi` explicitly.
- `test-setup.ts` unmounts rendered components after each test and polyfills `<dialog>.showModal()` / `close()` (jsdom lacks them). Real focus and Escape behaviour of the modal must be checked in a browser.
- Mock the `api` axios instance, not the network, when testing hooks and components that fetch.
- Test through the user's view: query by role and accessible name (`getByRole('button', { name: /delete/i })`), not by class or test id.
- Existing tests: `useApiGet`, `useStoreSettings`, `ShopLayout`, `ProductImage`, `utils/pricing`.

## 5. Mobile (`mobile/`)

- Jest with the React Native preset (`jest.config.js`, `jest.setup.js`).
- ES-module-only packages must be listed in `transformIgnorePatterns`; native modules are mocked in `jest.setup.js`. When a new native or ESM-only dependency breaks the suite, add it to both.
- Existing tests: `cartSlice`, `variants`, `ProductImage`, `App`.

## 6. What to test

Put the test at the lowest level that can catch the bug.

| Change | Test |
| --- | --- |
| Business rule in `backend/src/utils/` | unit test with `fakeClient` |
| New or changed endpoint, permission, or status code | API test |
| Race or concurrency (double submit, stock, refunds) | API test, using real row locks |
| Pure helper (`pricing`, `orderDisplay`, variants) | plain unit test |
| Hook with state or fetching | Vitest hook test |
| Component with branching UI | Testing Library test |
| API response shape change | update the web and mobile types and any tests that build that shape |

Good targets are anything involving money, stock, order and return status, permissions and validation. Don't test framework behaviour, trivial markup, or Tailwind classes.

## 7. Writing good tests

- **One behaviour per test**, named for the outcome: `'refund cannot exceed what was paid'`.
- **Arrange through the API or helpers**, not by editing rows, unless you are setting up a state the API can't reach (use `query`).
- **Assert side effects** that matter: stock restored, `refunded_amount`, `payment_status`, notification created.
- **Keep tests independent.** Create your own users and products per test or `describe` rather than depending on another test's data.
- **No sleeps.** Await the thing you are waiting for.
- **No real external services.** Stripe, Cloudinary and Redis are faked or disabled.
- **Never point tests at a real database.** The API suite wipes its schema.
- **A bug fix gets a test** that fails without the fix.

## 8. Not covered by automated tests

- Real Stripe Checkout and webhooks. Use `stripe listen --forward-to localhost:5000/api/payments/webhook` and test card `4242 4242 4242 4242` by hand.
- Real browser behaviour: focus management, Escape and the native modal, responsive layout, forced-colours mode. Check these in a browser.
- Mobile on a device or emulator (native modules, keychain).
- Redis-backed caching against a live Redis (only the no-Redis path is tested).
