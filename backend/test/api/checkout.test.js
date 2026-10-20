// Placing orders that can't go ahead, and product image changes: a refused
// request must leave nothing behind.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('refused orders and image changes', { skip: h.skip }, () => {
  let buyer;
  let admin;
  let product;

  const address = { name: 'A', line1: '1 St', city: 'X', state: 'Y', zip: '1', country: 'US' };
  const place = (lines) => h.call(buyer.token, 'POST', '/payments/place-order', {
    items: lines, shipping_address: address, payment_method: 'cod',
  });
  const orderCount = async () => Number((await h.query('SELECT COUNT(*) FROM orders')).rows[0].count);

  before(async () => {
    await h.start();
    buyer = await h.register('erin');
    admin = await h.register('frank', 'admin');
    product = await h.createProduct({ price: 10, stock: 3 });
  });
  after(h.stop);

  test('more than is in stock: 409 with what is available, and nothing is kept', async () => {
    const other = await h.createProduct({ price: 5, stock: 10 });
    const before = await orderCount();
    // The in-stock line is priced first (lines are locked in id order) or
    // second; either way the whole order is rolled back.
    const r = await place([
      { variant_id: other.variantId, quantity: 2 },
      { variant_id: product.variantId, quantity: 5 },
    ]);
    assert.equal(r.status, 409);
    assert.equal(r.data.available, 3);
    assert.equal(r.data.variant_id, product.variantId);
    assert.equal(await orderCount(), before);
    assert.equal(await h.stockOf(product.variantId), 3);
    assert.equal(await h.stockOf(other.variantId), 10);
  });

  test('an inactive product is refused with 400', async () => {
    await h.query('UPDATE products SET is_active = FALSE WHERE id = $1', [product.productId]);
    try {
      const r = await place([{ variant_id: product.variantId, quantity: 1 }]);
      assert.equal(r.status, 400);
      assert.match(r.data.error, /no longer available/);
    } finally {
      await h.query('UPDATE products SET is_active = TRUE WHERE id = $1', [product.productId]);
    }
  });

  test('a valid order still goes through and takes the stock', async () => {
    const r = await place([{ variant_id: product.variantId, quantity: 2 }]);
    assert.equal(r.status, 200);
    assert.equal(await h.stockOf(product.variantId), 1);
  });

  describe('primary image', () => {
    const addImage = async (productId, url, isPrimary) => (await h.query(
      'INSERT INTO product_images (product_id, url, is_primary) VALUES ($1, $2, $3) RETURNING id',
      [productId, url, isPrimary]
    )).rows[0].id;
    const primaries = async (productId) => (await h.query(
      'SELECT url FROM product_images WHERE product_id = $1 AND is_primary ORDER BY url', [productId]
    )).rows.map((r) => r.url);

    test("another product's image can't be made primary, and nothing changes", async () => {
      const mine = await addImage(product.productId, '/uploads/mine.png', true);
      const other = await h.createProduct();
      const theirs = await addImage(other.productId, '/uploads/theirs.png', false);

      const r = await h.call(admin.token, 'PUT', `/products/${product.productId}/images/${theirs}/primary`);
      assert.equal(r.status, 404);
      assert.deepEqual(await primaries(product.productId), ['/uploads/mine.png']);
      assert.deepEqual(await primaries(other.productId), []);

      const second = await addImage(product.productId, '/uploads/second.png', false);
      assert.equal((await h.call(admin.token, 'PUT', `/products/${product.productId}/images/${second}/primary`)).status, 200);
      assert.deepEqual(await primaries(product.productId), ['/uploads/second.png']);
      assert.ok(mine);
    });

    test('deleting the primary image promotes another one', async () => {
      const [primaryRow] = (await h.query(
        'SELECT id FROM product_images WHERE product_id = $1 AND is_primary', [product.productId]
      )).rows;
      const r = await h.call(admin.token, 'DELETE', `/products/${product.productId}/images/${primaryRow.id}`);
      assert.equal(r.status, 200);
      assert.deepEqual(await primaries(product.productId), ['/uploads/mine.png']);
      assert.equal((await h.call(admin.token, 'DELETE', `/products/${product.productId}/images/${primaryRow.id}`)).status, 404);
    });
  });
});
