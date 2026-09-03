import {configureStore} from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import settingsReducer from './slices/settingsSlice';
import {saveCart} from '../utils/storage';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    settings: settingsReducer,
  },
});

// Persist the cart whenever it changes, so a cold start restores it.
let lastCart = store.getState().cart.items;
store.subscribe(() => {
  const {items, hydrated} = store.getState().cart;
  if (hydrated && items !== lastCart) {
    lastCart = items;
    void saveCart(items);
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
