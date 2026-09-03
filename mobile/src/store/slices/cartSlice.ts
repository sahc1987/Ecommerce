import {createAsyncThunk, createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {loadCart} from '../../utils/storage';
import {effectivePrice} from '../../utils/format';
import type {CartItem, Product} from '../../types';

interface CartState {
  items: CartItem[];
  hydrated: boolean;
}

const initialState: CartState = {items: [], hydrated: false};

export const hydrateCart = createAsyncThunk('cart/hydrate', async () => {
  const saved = await loadCart<CartItem[]>();
  return saved ?? [];
});

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<{product: Product; quantity?: number}>) {
      const {product, quantity = 1} = action.payload;
      const existing = state.items.find(i => i.product_id === product.id);
      if (existing) {
        // Never let the local cart exceed known stock; the server re-checks anyway.
        existing.quantity = Math.min(existing.quantity + quantity, product.stock);
        return;
      }
      state.items.push({
        product_id: product.id,
        name: product.name,
        slug: product.slug,
        price: effectivePrice(product),
        image: product.primary_image ?? product.images?.[0]?.url ?? null,
        quantity: Math.min(quantity, product.stock),
        stock: product.stock,
      });
    },
    setQuantity(
      state,
      action: PayloadAction<{product_id: string; quantity: number}>,
    ) {
      const item = state.items.find(i => i.product_id === action.payload.product_id);
      if (!item) {
        return;
      }
      const next = Math.max(1, Math.min(action.payload.quantity, item.stock));
      item.quantity = next;
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => i.product_id !== action.payload);
    },
    clearCart(state) {
      state.items = [];
    },
  },
  extraReducers: builder => {
    builder.addCase(hydrateCart.fulfilled, (state, action) => {
      state.items = action.payload;
      state.hydrated = true;
    });
    builder.addCase(hydrateCart.rejected, state => {
      state.hydrated = true;
    });
  },
});

export const {addItem, setQuantity, removeItem, clearCart} = cartSlice.actions;
export default cartSlice.reducer;

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export const cartCount = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0);
