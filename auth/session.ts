export type AuthSession = {
  accessToken?: string;
  expiresAt?: string;
  userId?: string;
};

export type AuthUser = {
  email?: string;
  id?: string;
  name?: string;
};

export type SessionState = {
  isLoading: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
};

export const initialSessionState: SessionState = {
  isLoading: false,
  session: null,
  user: null,
};
