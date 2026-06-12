import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  CODE_VERIFIER_KEY,
  EXPECTED_STATE_KEY,
  LEGACY_USER_ASYNC_KEY,
  REFRESH_TOKEN_KEY,
  USER_SECURE_KEY,
} from '@/auth/session';

const SECURE_KEYS = [
  USER_SECURE_KEY,
  REFRESH_TOKEN_KEY,
  CODE_VERIFIER_KEY,
  EXPECTED_STATE_KEY,
] as const;

const ASYNC_KEYS = [
  LEGACY_USER_ASYNC_KEY,
] as const;

export async function clearAuthStorage(): Promise<void> {
  await Promise.all([
    ...SECURE_KEYS.map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (err) {
        console.warn('[Auth] failed to clear SecureStore key:', key, err);
      }
    }),
    ...ASYNC_KEYS.map(async (key) => {
      try {
        await AsyncStorage.removeItem(key);
      } catch (err) {
        console.warn('[Auth] failed to clear AsyncStorage key:', key, err);
      }
    }),
  ]);
}
