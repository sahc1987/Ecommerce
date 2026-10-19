import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// One line per variant: "Camisa Rojo / M" and "Camisa Rojo / L" are separate.
// Carts saved before variants have no variant_id; the server maps those to the
// product's only variant and setReservations fills it in.
export interface CartItem {
  product_id: string;
  variant_id?: string | null;
  variant_label?: string | null; // "Rojo / M"; absent for single-variant products
  sku?: string | null;
  slug?: string;
  name: string;
  price: number;
  effective_price: number;
  image?: string;
  quantity: number;
  stock: number;
}

// Identifies a cart line, for reservations, quantity changes and removal.
export const lineKey = (i: Pick<CartItem, 'product_id' | 'variant_id'>): string => i.variant_id ?? i.product_id;

// Server-side stock hold for one cart line (see /api/reservations).
export interface Reservation {
  reserved: number;   // units the server is holding for this cart
  available: number;  // units this cart could hold (stock minus other carts)
  expires_at: string | null;
  needsOption?: boolean; // the line names a product with several variants
}

export type HoldStatus = 'none' | 'active' | 'expired';

interface CartState {
  items: CartItem[];
  reservations: Record<string, Reservation>;
  holdExpiresAt: string | null;
  holdStatus: HoldStatus;
  syncing: boolean;
}

const loadCart = (): CartItem[] => {
  try {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const initialState: CartState = {
  items: loadCart(),
  reservations: {},
  holdExpiresAt: null,
  holdStatus: 'none',
  syncing: false,
};

const saveCart = (items: CartItem[]) => {
  try {
    localStorage.setItem('cart', JSON.stringify(items));
  } catch {
    // Storage full or blocked (private mode): the cart still works for this visit.
  }
};

interface ReservationResult {
  product_id: string | null;
  variant_id?: string | null;
  reserved?: number;
  quantity?: number;
  available?: number;
  expires_at: string | null;
  error?: string;
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<CartItem>) {
      const key = lineKey(action.payload);
      const existing = state.items.find((i) => lineKey(i) === key);
      if (existing) {
        existing.stock = action.payload.stock;
        existing.quantity = Math.min(existing.quantity + action.payload.quantity, existing.stock);
      } else {
        state.items.push(action.payload);
      }
      saveCart(state.items);
    },
    // Payload: the line's key (see lineKey).
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => lineKey(i) !== action.payload);
      delete state.reservations[action.payload];
      saveCart(state.items);
    },
    updateQuantity(state, action: PayloadAction<{ key: string; quantity: number }>) {
      const item = state.items.find((i) => lineKey(i) === action.payload.key);
      if (item) {
        item.quantity = Math.min(Math.max(1, action.payload.quantity), item.stock);
      }
      saveCart(state.items);
    },
    clearCart(state) {
      state.items = [];
      state.reservations = {};
      state.holdExpiresAt = null;
      state.holdStatus = 'none';
      try {
        localStorage.removeItem('cart');
      } catch {
        // Storage blocked: nothing was saved to remove.
      }
    },
    // Result of PUT /reservations or POST /reservations/renew.
    setReservations(
      state,
      action: PayloadAction<{ items: ReservationResult[]; expires_at: string | null }>
    ) {
      // Lines saved before variants learn their variant from the server.
      let upgraded = false;
      for (const r of action.payload.items) {
        if (!r.variant_id || !r.product_id) continue;
        const legacy = state.items.find((i) => !i.variant_id && i.product_id === r.product_id);
        if (legacy && !state.items.some((i) => i.variant_id === r.variant_id)) {
          legacy.variant_id = r.variant_id;
          upgraded = true;
        }
      }
      if (upgraded) saveCart(state.items);

      const next: Record<string, Reservation> = {};
      for (const r of action.payload.items) {
        const key = r.variant_id ?? r.product_id;
        if (!key) continue;
        const reserved = r.reserved ?? r.quantity ?? 0;
        next[key] = {
          reserved,
          available: r.available ?? reserved,
          expires_at: r.expires_at,
          needsOption: r.error === 'variant_required',
        };
      }
      // Lines the server didn't mention keep nothing (renew only returns live holds).
      state.reservations = next;
      state.holdExpiresAt = action.payload.expires_at;
      state.holdStatus = state.items.length && action.payload.expires_at ? 'active' : 'none';
      state.syncing = false;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.syncing = action.payload;
    },
    // The hold timer ran out client-side; the server has released the units.
    expireReservations(state) {
      if (state.holdStatus === 'active') state.holdStatus = 'expired';
      state.holdExpiresAt = null;
      for (const r of Object.values(state.reservations)) r.reserved = 0;
    },
  },
});

export const {
  addItem, removeItem, updateQuantity, clearCart, setReservations, setSyncing, expireReservations,
} = cartSlice.actions;
export default cartSlice.reducer;
