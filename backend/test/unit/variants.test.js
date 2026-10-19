const { test } = require('node:test');
const assert = require('node:assert/strict');
const variants = require('../../src/utils/variants');

const ID = 'd85a7e13-ede6-444a-a4e0-33f4f137dd74';

test('a product without options has exactly one default variant', () => {
  const ok = variants.parseVariantInput([], [{ stock: '5', sku: ' ABC ' }]);
  assert.deepEqual(ok.variants, [{ id: null, sku: 'ABC', options: {}, price: null, stock: 5, is_active: true }]);
  assert.match(variants.parseVariantInput([], [{}, {}]).error, /exactly one variant/);
});

test('every variant picks one valid value per option, with no duplicates', () => {
  const options = [{ name: 'Color', values: ['Rojo', 'Azul'] }];
  assert.ok(variants.parseVariantInput(options, [{ options: { Color: 'Rojo' } }, { options: { Color: 'Azul' } }]).variants);
  assert.match(variants.parseVariantInput(options, [{ options: { Color: 'Verde' } }]).error, /invalid value/);
  assert.match(
    variants.parseVariantInput(options, [{ options: { Color: 'Rojo' } }, { options: { Color: 'Rojo' } }]).error,
    /Duplicate variant Rojo/,
  );
});

test('SKUs must be unique within a product, blanks mean none', () => {
  const options = [{ name: 'Size', values: ['S', 'M'] }];
  const twice = variants.parseVariantInput(options, [
    { options: { Size: 'S' }, sku: 'X' },
    { options: { Size: 'M' }, sku: 'X' },
  ]);
  assert.match(twice.error, /used twice/);
  assert.equal(variants.cleanSku('   '), null);
});

test('negative prices and fractional stock are refused', () => {
  assert.match(variants.parseVariantInput([], [{ price: -1 }]).error, /price/);
  assert.match(variants.parseVariantInput([], [{ stock: 1.5 }]).error, /stock/);
});

test('cart lines need a UUID and a whole quantity in range', () => {
  assert.equal(variants.validateLines([{ variant_id: ID, quantity: 2 }], 50), null);
  assert.equal(variants.validateLines([{ product_id: ID, quantity: '3' }], 50), null);
  assert.equal(variants.validateLines([], 50), 'Cart is empty');
  assert.match(variants.validateLines([{ variant_id: 'x', quantity: 1 }], 50), /valid variant_id/);
  for (const quantity of [0, -1, 1.5, variants.MAX_QTY + 1])
    assert.match(variants.validateLines([{ variant_id: ID, quantity }], 50), /whole quantity/, String(quantity));
  assert.match(variants.validateLines([{ variant_id: ID, quantity: 1 }, { variant_id: ID, quantity: 1 }], 1), /At most 1/);
});

test('a running discount lowers the price; an expired one does not', () => {
  const base = { price: '100', discount_active: true, discount_percent: '20' };
  assert.equal(variants.effectivePrice(base), 80);
  assert.equal(variants.effectivePrice(base, '50'), 40);
  assert.equal(variants.effectivePrice({ ...base, discount_end: '2000-01-01' }), 100);
  assert.equal(variants.effectivePrice({ ...base, discount_active: false }), 100);
});
