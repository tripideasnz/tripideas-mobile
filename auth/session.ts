export type AuthSession = {
  userId: string;
  accessToken: string;
};

export type AuthUser = {
  email: string;
  id: string;
  name?: string;
};

export type SessionState = {
  isLoading: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
};

export type AuthContextValue = SessionState & {
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const initialSessionState: SessionState = {
  isLoading: true,
  session: null,
  user: null,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────
// All auth-related keys in one place so clearAuthStorage() can enumerate them.

export const USER_SECURE_KEY       = 'tripideas.user.v1';
export const REFRESH_TOKEN_KEY     = 'tripideas.refresh-token.v1';
export const CODE_VERIFIER_KEY     = 'tripideas.pkce.verifier.v1';
export const EXPECTED_STATE_KEY    = 'tripideas.pkce.state.v1';

// Keys from earlier implementations that may still be present on device.
export const LEGACY_USER_ASYNC_KEY = 'tripideas.user.v1'; // was AsyncStorage before SecureStore
