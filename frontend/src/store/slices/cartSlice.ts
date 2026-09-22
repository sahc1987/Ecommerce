import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  effective_price: number;
  image?: string;
  quantity: number;
  stock: number;
}

// Server-side stock hold for one cart line (see /api/reservations).
export interface Reservation {
  reserved: number;   // units the server is holding for this cart
  available: number;  // units this cart could hold (stock minus other carts)
  expires_at: string | null;
}

export type HoldStatus = 'none' | 'active' | 'expired';

interface CartState {
  items: CartItem[];
  reservations: Record<string, Reservation>;
  holdExpiresAt: string | null;
  holdStatus: HoldStatus;
  syncing: boolean;
}

const savedCart = localStorage.getItem('cart');
const initialState: CartState = {
  items: savedCart ? JSON.parse(savedCart) : [],
  reservations: {},
  holdExpiresAt: null,
  holdStatus: 'none',
  syncing: false,
};

const saveCart = (items: CartItem[]) => {
  localStorage.setItem('cart', JSON.stringify(items));
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((i) => i.product_id === action.payload.product_id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + action.payload.quantity, existing.stock);
      } else {
        state.items.push(action.payload);
      }
      saveCart(state.items);
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.product_id !== action.payload);
      delete state.reservations[action.payload];
      saveCart(state.items);
    },
    updateQuantity(state, action: PayloadAction<{ product_id: string; quantity: number }>) {
      const item = state.items.find((i) => i.product_id === action.payload.product_id);
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
      localStorage.removeItem('cart');
    },
    // Result of PUT /reservations or POST /reservations/renew.
    setReservations(
      state,
      action: PayloadAction<{ items: { product_id: string; reserved?: number; quantity?: number; available?: number; expires_at: string | null }[]; expires_at: string | null }>
    ) {
      const next: Record<string, Reservation> = {};
      for (const r of action.payload.items) {
        const reserved = r.reserved ?? r.quantity ?? 0;
        next[r.product_id] = {
          reserved,
          available: r.available ?? reserved,
          expires_at: r.expires_at,
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
