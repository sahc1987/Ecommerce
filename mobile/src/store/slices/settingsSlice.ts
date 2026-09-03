import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setupApi} from '../../api';
import {setCurrency} from '../../utils/format';
import type {StoreSettings} from '../../types';

interface SettingsState {
  store: StoreSettings | null;
  configured: boolean;
  loaded: boolean;
}

const initialState: SettingsState = {
  store: null,
  configured: false,
  loaded: false,
};

/**
 * Store settings drive the currency symbol and the return window copy, so the
 * app loads them once on start. Failure is non-fatal — we fall back to USD.
 */
export const loadStoreSettings = createAsyncThunk('settings/load', async () => {
  const {data} = await setupApi.status();
  return data;
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(loadStoreSettings.fulfilled, (state, action) => {
        state.store = action.payload.store;
        state.configured = action.payload.configured;
        state.loaded = true;
        setCurrency(action.payload.store?.currency);
      })
      .addCase(loadStoreSettings.rejected, state => {
        state.loaded = true;
      });
  },
});

export default settingsSlice.reducer;
