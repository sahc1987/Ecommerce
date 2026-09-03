import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const TOKEN_SERVICE = 'ecommerce.auth';
const CART_KEY = '@ecommerce/cart';

/**
 * The JWT lives in the OS keystore/keychain rather than AsyncStorage, which is
 * plain-text on a rooted device.
 */
export const saveToken = async (token: string) => {
  await Keychain.setGenericPassword('token', token, {service: TOKEN_SERVICE});
};

export const loadToken = async (): Promise<string | null> => {
  try {
    const creds = await Keychain.getGenericPassword({service: TOKEN_SERVICE});
    return creds ? creds.password : null;
  } catch {
    return null;
  }
};

export const clearToken = async () => {
  try {
    await Keychain.resetGenericPassword({service: TOKEN_SERVICE});
  } catch {
    // nothing stored — nothing to clear
  }
};

export const saveCart = async (value: unknown) => {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(value));
};

export const loadCart = async <T>(): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(CART_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};
