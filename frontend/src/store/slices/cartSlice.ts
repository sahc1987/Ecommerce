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

interface CartState {
  items: CartItem[];
}

const savedCart = localStorage.getItem('cart');
const initialState: CartState = {
  items: savedCart ? JSON.parse(savedCart) : [],
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
      localStorage.removeItem('cart');
    },
  },
});

export const { addItem, removeItem, updateQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
