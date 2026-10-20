// Shared setup for the API tests: a fresh schema in a throwaway database, the
// app on a random port, and small helpers to call it.
//
// Needs TEST_DATABASE_URL pointing at a database whose name contains "test";
// it is wiped on every run. Without it the API tests are skipped.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TEST_DB = process.env.TEST_DATABASE_URL;
const skip = TEST_DB ? false : 'set TEST_DATABASE_URL to run the API tests';

if (TEST_DB) {
  const dbName = new URL(TEST_DB).pathname.slice(1);
  if (!/test/i.test(dbName))
    throw new Error(`Refusing to wipe "${dbName}": TEST_DATABASE_URL must name a database containing "test"`);
  process.env.DATABASE_URL = TEST_DB;
  process.env.JWT_SECRET ||= crypto.randomBytes(16).toString('hex');
  delete process.env.STRIPE_SECRET_KEY; // card payments stay off: no real money in tests
  // No cache: keys don't name the database, so a shared Redis could answer
  // with another database's products. Nothing listens on port 1.
  process.env.REDIS_URL = 'redis://127.0.0.1:1';
}

let server;
let baseUrl;
let db;

async function start() {
  db = require('../../src/config/database');
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await db.query(fs.readFileSync(path.join(__dirname, '../../src/db/schema.sql'), 'utf8'));
  // The first account to register becomes admin; take that slot so test
  // customers register as customers.
  await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('seed', 'seed@test.dev', 'x', 'admin')");
  await db.query("INSERT INTO store_settings (name, return_window_days) VALUES ('Test store', 30)");

  const app = require('../../src/app');
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
}

async function stop() {
  await new Promise((resolve) => server?.close(resolve));
  await db?.end();
  require('../../src/config/redis').disconnect();
}

async function call(token, method, url, body) {
  const res = await fetch(baseUrl + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function register(name, role) {
  const email = `${name}-${crypto.randomUUID()}@test.dev`;
  const r = await call(null, 'POST', '/auth/register', { name, email, password: 'Passw0rd!long' });
  if (r.status !== 201) throw new Error(`register ${name}: ${r.status} ${JSON.stringify(r.data)}`);
  if (role) await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, r.data.user.id]);
  return { token: r.data.token, id: r.data.user.id };
}

// A product with one default variant holding `stock` units at `price`.
async function createProduct({ price = 25, stock = 50 } = {}) {
  const p = (await db.query(
    "INSERT INTO products (name, slug, price) VALUES ('Mug', 'mug-' || gen_random_uuid(), $1) RETURNING id, slug",
    [price]
  )).rows[0];
  const v = (await db.query('INSERT INTO product_variants (product_id, stock) VALUES ($1, $2) RETURNING id', [p.id, stock])).rows[0];
  return { productId: p.id, slug: p.slug, variantId: v.id };
}

const stockOf = async (variantId) =>
  (await db.query('SELECT stock FROM product_variants WHERE id = $1', [variantId])).rows[0].stock;

module.exports = { skip, start, stop, call, register, createProduct, stockOf, query: (...a) => db.query(...a) };
