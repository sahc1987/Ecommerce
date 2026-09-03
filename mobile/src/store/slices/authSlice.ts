import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {authApi} from '../../api';
import {errorMessage, restoreAuthToken, setAuthToken} from '../../api/client';
import {clearToken, saveToken} from '../../utils/storage';
import type {User} from '../../types';

interface AuthState {
  user: User | null;
  /** True until the cold-start token check finishes, so we can show a splash. */
  booting: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  booting: true,
  loading: false,
  error: null,
};

/** Cold start: pull the saved JWT out of the keychain and validate it. */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  const token = await restoreAuthToken();
  if (!token) {
    return null;
  }
  try {
    const {data} = await authApi.me();
    return data.user;
  } catch {
    await clearToken();
    setAuthToken(null);
    return null;
  }
});

export const login = createAsyncThunk(
  'auth/login',
  async (payload: {email: string; password: string}, {rejectWithValue}) => {
    try {
      const {data} = await authApi.login(payload.email, payload.password);
      await saveToken(data.token);
      setAuthToken(data.token);
      return data.user;
    } catch (err) {
      return rejectWithValue(errorMessage(err, 'Login failed'));
    }
  },
);

export const register = createAsyncThunk(
  'auth/register',
  async (
    payload: {name: string; email: string; password: string},
    {rejectWithValue},
  ) => {
    try {
      const {data} = await authApi.register(
        payload.name,
        payload.email,
        payload.password,
      );
      await saveToken(data.token);
      setAuthToken(data.token);
      return data.user;
    } catch (err) {
      return rejectWithValue(errorMessage(err, 'Registration failed'));
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } catch {
    // A failed logout call should never trap the user in a signed-in state.
  }
  await clearToken();
  setAuthToken(null);
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    /** Called by the 401 interceptor when the server rejects our token. */
    sessionExpired(state) {
      state.user = null;
      state.loading = false;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.booting = false;
      })
      .addCase(bootstrapAuth.rejected, state => {
        state.booting = false;
      })
      .addCase(logout.fulfilled, state => {
        state.user = null;
      });

    for (const thunk of [login, register]) {
      builder
        .addCase(thunk.pending, state => {
          state.loading = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading = false;
          state.user = action.payload;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading = false;
          state.error = (action.payload as string) ?? 'Something went wrong';
        });
    }
  },
});

export const {clearError, sessionExpired} = authSlice.actions;
export default authSlice.reducer;
