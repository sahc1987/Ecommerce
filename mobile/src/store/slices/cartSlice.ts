import {createAsyncThunk, createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {loadCart} from '../../utils/storage';
import {applyDiscount, effectivePrice, sellableStock} from '../../utils/format';
import {singleVariant, variantLabel} from '../../utils/variants';
import {reservationsApi, type CartLine, type ReservationResponse} from '../../api';
import type {CartItem, Product, Variant} from '../../types';

/** Identifies a cart line: its variant, or the product for carts saved before variants. */
export const lineKey = (i: Pick<CartItem, 'product_id' | 'variant_id'>) =>
  i.variant_id ?? i.product_id;

/** Request body line for /reservations and /payments/place-order. */
export const toCartLine = (i: CartItem): CartLine =>
  i.variant_id
    ? {variant_id: i.variant_id, quantity: i.quantity}
    : {product_id: i.product_id, quantity: i.quantity};

/** Server-side stock hold for one cart line. */
export interface Reservation {
  reserved: number;
  available: number;
  expires_at: string | null;
  /** The line names a product that now has several variants. */
  needsOption?: boolean;
}

export type HoldStatus = 'none' | 'active' | 'expired';

interface CartState {
  items: CartItem[];
  hydrated: boolean;
  reservations: Record<string, Reservation>;
  holdExpiresAt: string | null;
  holdStatus: HoldStatus;
  syncing: boolean;
}

const initialState: CartState = {
  items: [],
  hydrated: false,
  reservations: {},
  holdExpiresAt: null,
  holdStatus: 'none',
  syncing: false,
};

export const hydrateCart = createAsyncThunk('cart/hydrate', async () => {
  const saved = await loadCart<CartItem[]>();
  return saved ?? [];
});

/** PUT the whole cart: (re)creates holds and restarts the 3-minute timer. */
export const syncReservations = createAsyncThunk<ReservationResponse, void, {state: {cart: CartState}}>(
  'cart/syncReservations',
  async (_, {getState}) => {
    const {items} = getState().cart;
    if (items.length === 0) {
      return {items: [], expires_at: null, hold_minutes: 0};
    }
    const {data} = await reservationsApi.sync(items.map(toCartLine));
    return data;
  },
);

/** Extend live holds; falls back to a full sync when none are live any more. */
export const renewReservations = createAsyncThunk<ReservationResponse | null, void, {state: {cart: CartState}; dispatch: any}>(
  'cart/renewReservations',
  async (_, {getState, dispatch}) => {
    if (getState().cart.items.length === 0) {
      return null;
    }
    const {data} = await reservationsApi.renew();
    if (data.items.length === 0) {
      await dispatch(syncReservations());
      return null;
    }
    return data;
  },
);

const applyReservations = (state: CartState, data: ReservationResponse) => {
  // Lines saved before variants learn their variant from the server.
  for (const r of data.items) {
    if (!r.variant_id || !r.product_id) {
      continue;
    }
    const legacy = state.items.find(i => !i.variant_id && i.product_id === r.product_id);
    if (legacy && !state.items.some(i => i.variant_id === r.variant_id)) {
      legacy.variant_id = r.variant_id;
    }
  }

  const next: Record<string, Reservation> = {};
  for (const r of data.items) {
    const key = r.variant_id ?? r.product_id;
    if (!key) {
      continue;
    }
    const reserved = r.reserved ?? r.quantity ?? 0;
    next[key] = {
      reserved,
      available: r.available ?? reserved,
      expires_at: r.expires_at,
      needsOption: r.error === 'variant_required',
    };
  }
  state.reservations = next;
  state.holdExpiresAt = data.expires_at;
  state.holdStatus = state.items.length && data.expires_at ? 'active' : 'none';
  state.syncing = false;
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /**
     * Adds `variant` of `product` (one line per variant). Without a variant the
     * product's only variant is used, as for products without options.
     */
    addItem(
      state,
      action: PayloadAction<{product: Product; variant?: Variant | null; quantity?: number}>,
    ) {
      const {product, quantity = 1} = action.payload;
      const variant = action.payload.variant ?? singleVariant(product);
      const stock = variant ? variant.available_stock ?? variant.stock : sellableStock(product);
      const line = {product_id: product.id, variant_id: variant?.id ?? null};
      const existing = state.items.find(i => lineKey(i) === lineKey(line));
      if (existing) {
        // Never let the local cart exceed known stock; the server re-checks anyway.
        existing.stock = stock;
        existing.quantity = Math.min(existing.quantity + quantity, stock);
        return;
      }
      state.items.push({
        ...line,
        variant_label: variant ? variantLabel(product.options, variant.options) : null,
        sku: variant?.sku ?? null,
        name: product.name,
        slug: product.slug,
        price: variant?.price != null ? applyDiscount(product, variant.price) : effectivePrice(product),
        image: product.primary_image ?? product.images?.[0]?.url ?? null,
        quantity: Math.min(quantity, stock),
        stock,
      });
    },
    /** `key` is the line's lineKey(). */
    setQuantity(state, action: PayloadAction<{key: string; quantity: number}>) {
      const item = state.items.find(i => lineKey(i) === action.payload.key);
      if (!item) {
        return;
      }
      const next = Math.max(1, Math.min(action.payload.quantity, item.stock));
      item.quantity = next;
    },
    /** Payload: the line's lineKey(). */
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => lineKey(i) !== action.payload);
      delete state.reservations[action.payload];
    },
    clearCart(state) {
      state.items = [];
      state.reservations = {};
      state.holdExpiresAt = null;
      state.holdStatus = 'none';
    },
    /** The hold timer ran out on the device; the server has released the units. */
    expireReservations(state) {
      if (state.holdStatus === 'active') {
        state.holdStatus = 'expired';
      }
      state.holdExpiresAt = null;
      for (const r of Object.values(state.reservations)) {
        r.reserved = 0;
      }
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
    builder.addCase(syncReservations.pending, state => {
      state.syncing = true;
    });
    builder.addCase(syncReservations.fulfilled, (state, action) => {
      applyReservations(state, action.payload);
    });
    builder.addCase(syncReservations.rejected, state => {
      state.syncing = false;
    });
    builder.addCase(renewReservations.fulfilled, (state, action) => {
      if (action.payload) {
        applyReservations(state, action.payload);
      }
    });
  },
});

export const {addItem, setQuantity, removeItem, clearCart, expireReservations} =
  cartSlice.actions;
export default cartSlice.reducer;

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export const cartCount = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0);

export type LineStatus = 'ok' | 'partial' | 'unavailable' | 'needs_option' | 'expired' | 'pending';

/** What the UI should say about one cart line given the server's hold on it. */
export const lineStatus = (
  item: CartItem,
  r: Reservation | undefined,
  hold: HoldStatus,
): LineStatus => {
  if (r?.needsOption) {
    return 'needs_option';
  }
  if (hold === 'expired') {
    return 'expired';
  }
  if (!r) {
    return hold === 'none' ? 'pending' : 'ok';
  }
  if (r.reserved === 0) {
    return 'unavailable';
  }
  if (r.reserved < item.quantity) {
    return 'partial';
  }
  return 'ok';
};

/** True when any line can't be bought as-is, so checkout should be blocked. */
export const cartBlocked = (state: CartState) =>
  state.items.some(i => lineStatus(i, state.reservations[lineKey(i)], state.holdStatus) !== 'ok');

/** Stable key of cart lines + quantities; changes exactly when holds must re-sync. */
export const cartSignature = (items: CartItem[]) =>
  items.map(i => `${lineKey(i)}:${i.quantity}`).sort((a, b) => a.localeCompare(b)).join('|');
