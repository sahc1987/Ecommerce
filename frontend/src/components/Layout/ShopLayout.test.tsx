import { act, fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { Link, MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer from '../../store/slices/authSlice';
import cartReducer from '../../store/slices/cartSlice';
import { useAddToCart } from '../../hooks/useAddToCart';
import type { Product } from '../../utils/pricing';
import ShopLayout, { type ShopOutletContext } from './ShopLayout';

vi.mock('../../api', () => {
  const responses: Record<string, unknown> = {
    '/categories': { categories: [] },
    '/setup/status': { store: { name: 'Test Store', return_window_days: 14 } },
  };
  return {
    default: {
      get: vi.fn((url: string) => Promise.resolve({ data: responses[url] ?? { products: [] } })),
      // The server holds every requested unit for 3 minutes.
      put: vi.fn((_url: string, body: { items: { variant_id: string; quantity: number }[] }) => {
        const expires_at = new Date(Date.now() + 180_000).toISOString();
        return Promise.resolve({
          data: {
            items: body.items.map((l) => ({ product_id: 'p1', variant_id: l.variant_id, reserved: l.quantity, available: 5, expires_at })),
            expires_at,
          },
        });
      }),
      post: vi.fn(() => Promise.resolve({ data: {} })),
    },
    errorMessage: (_err: unknown, fallback: string) => fallback,
  };
});

const mouse = {
  id: 'p1', slug: 'mx-master-3s', name: 'MX Master 3S', price: '99.00', compare_at_price: null,
  stock: 5, available_stock: 5, primary_image: null,
  discount_active: false, discount_percent: null, discount_start: null, discount_end: null,
  options: [], variants: [{ id: 'v1', sku: 'MX3S', options: {}, stock: 5, price: null }],
} as unknown as Product;

// Stands in for a product card: adds through the same hook the shop uses.
function FakeCard() {
  const { openCart } = useOutletContext<ShopOutletContext>();
  const add = useAddToCart(openCart);
  return (
    <>
      <button type="button" onClick={() => add(mouse)}>Add to cart</button>
      <Link to="/other">Other page</Link>
    </>
  );
}

async function renderShop() {
  const store = configureStore({ reducer: { auth: authReducer, cart: cartReducer } });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Routes>
          <Route element={<ShopLayout />}>
            <Route path="/" element={<FakeCard />} />
            <Route path="/other" element={<p>Other</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  await act(async () => {}); // let the store/categories requests settle
  return store;
}

const drawer = () => screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;

describe('cart drawer', () => {
  beforeEach(() => localStorage.clear());

  it('opens after adding to cart and confirms the product', async () => {
    const store = await renderShop();
    expect(drawer().open).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(drawer().open).toBe(true);
    expect(store.getState().cart.items).toHaveLength(1);
    expect(screen.getByText('MX Master 3S', { selector: '#cart-drawer-added span' })).toBeTruthy();
    // Checkout unlocks once the server confirms the stock hold.
    expect(await screen.findByRole('link', { name: 'Checkout', hidden: true })).toHaveProperty('pathname', '/checkout');
    expect(screen.getByText(/Items reserved for/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View cart', hidden: true }).getAttribute('href')).toBe('/cart');
  });

  it('closes from its close button and when the browser closes it (Escape)', async () => {
    await renderShop();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close cart', hidden: true }));
    expect(drawer().open).toBe(false);

    // Escape closes a modal dialog natively and fires `close`; the shop must follow.
    fireEvent.click(screen.getByRole('button', { name: /^Cart, 1 item/ }));
    expect(drawer().open).toBe(true);
    act(() => drawer().close());
    expect(drawer().open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^Cart, 1 item/ }));
    expect(drawer().open).toBe(true);
  });

  it('closes when the shopper moves to another page', async () => {
    await renderShop();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(drawer().open).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Other page', hidden: true }));
    expect(screen.getByText('Other')).toBeTruthy();
    expect(drawer().open).toBe(false);
  });

  it('shows the store promises above the footer', async () => {
    await renderShop();
    expect(screen.getByText('Within 14 days of your order')).toBeTruthy();
  });
});
