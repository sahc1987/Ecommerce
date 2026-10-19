import reducer, {
  addItem,
  cartBlocked,
  cartSubtotal,
  expireReservations,
  lineStatus,
  removeItem,
  setQuantity,
} from '../src/store/slices/cartSlice';
import type {Product, Variant} from '../src/types';

const variant = (
  id: string,
  stock: number,
  extra: Partial<Variant> = {},
): Variant => ({
  id,
  sku: null,
  options: {},
  price: null,
  stock,
  is_active: true,
  ...extra,
});

const product = (extra: Partial<Product> = {}): Product =>
  ({
    id: 'p1',
    name: 'Mug',
    slug: 'mug',
    price: '10.00',
    discount_active: false,
    discount_percent: '0',
    discount_start: null,
    discount_end: null,
    stock: 3,
    variants: [variant('v1', 3)],
    options: [],
    ...extra,
  } as Product);

const empty = reducer(undefined, {type: 'init'});

describe('cart', () => {
  it('adds a product without options as its only variant', () => {
    const state = reducer(empty, addItem({product: product()}));
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      product_id: 'p1',
      variant_id: 'v1',
      quantity: 1,
      price: 10,
    });
  });

  it('never holds more units than are in stock', () => {
    let state = reducer(empty, addItem({product: product(), quantity: 2}));
    state = reducer(state, addItem({product: product(), quantity: 5}));
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(3);
    state = reducer(state, setQuantity({key: 'v1', quantity: 99}));
    expect(state.items[0].quantity).toBe(3);
    state = reducer(state, setQuantity({key: 'v1', quantity: 0}));
    expect(state.items[0].quantity).toBe(1);
  });

  it('uses the variant price with the product discount applied', () => {
    const p = product({discount_active: true, discount_percent: '50'});
    const state = reducer(
      empty,
      addItem({product: p, variant: variant('v2', 5, {price: 30})}),
    );
    expect(state.items[0].price).toBe(15);
    expect(cartSubtotal(state.items)).toBe(15);
  });

  it('keeps one line per variant', () => {
    const p = product();
    let state = reducer(empty, addItem({product: p, variant: variant('a', 5)}));
    state = reducer(state, addItem({product: p, variant: variant('b', 5)}));
    expect(state.items.map(i => i.variant_id)).toEqual(['a', 'b']);
    state = reducer(state, removeItem('a'));
    expect(state.items.map(i => i.variant_id)).toEqual(['b']);
  });

  it('blocks checkout once the hold expires', () => {
    let state = reducer(empty, addItem({product: product()}));
    state = {
      ...state,
      holdStatus: 'active',
      reservations: {v1: {reserved: 1, available: 1, expires_at: null}},
    };
    expect(cartBlocked(state)).toBe(false);
    state = reducer(state, expireReservations());
    expect(state.holdStatus).toBe('expired');
    expect(cartBlocked(state)).toBe(true);
  });

  it('reports partial and unavailable holds per line', () => {
    const item = {
      ...reducer(empty, addItem({product: product(), quantity: 3})).items[0],
    };
    expect(
      lineStatus(item, {reserved: 3, available: 3, expires_at: null}, 'active'),
    ).toBe('ok');
    expect(
      lineStatus(item, {reserved: 1, available: 1, expires_at: null}, 'active'),
    ).toBe('partial');
    expect(
      lineStatus(item, {reserved: 0, available: 0, expires_at: null}, 'active'),
    ).toBe('unavailable');
    expect(
      lineStatus(
        item,
        {reserved: 0, available: 0, expires_at: null, needsOption: true},
        'active',
      ),
    ).toBe('needs_option');
  });
});
