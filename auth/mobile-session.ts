import type { AuthUser, SessionState } from '@/auth/session';

export type MobileTokens = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser | null;
};

export type MobileSessionDependencies = {
  cacheUser: (user: AuthUser | null) => Promise<void>;
  clearAuthStorage: () => Promise<void>;
  clearNotebookCache: (userId: string) => Promise<void>;
  loadRefreshToken: () => Promise<string | null>;
  refresh: (refreshToken: string) => Promise<MobileTokens>;
  setActiveToken: (token: string | null) => void;
  storeRefreshToken: (token: string) => Promise<void>;
};

export type RefreshInFlight = {
  current: Promise<boolean> | null;
};

export function runCoalescedRefresh(
  inFlight: RefreshInFlight,
  refresh: () => Promise<boolean>
): Promise<boolean> {
  if (inFlight.current) return inFlight.current;
  const attempt = refresh().finally(() => {
    inFlight.current = null;
  });
  inFlight.current = attempt;
  return attempt;
}

export const signedOutSession = (): SessionState => ({
  isLoading: false,
  session: null,
  user: null,
});

export function selectRefreshUser(
  refreshedUser: AuthUser | null,
  authenticatedUser: AuthUser | null
): AuthUser | null {
  return refreshedUser ?? authenticatedUser;
}

export function authenticatedSession(
  user: AuthUser | null,
  accessToken: string
): SessionState {
  if (!user || !accessToken.trim()) return signedOutSession();
  return {
    isLoading: false,
    session: { userId: user.id, accessToken },
    user,
  };
}

function validTokens(tokens: MobileTokens): tokens is MobileTokens & { user: AuthUser } {
  return Boolean(
    tokens.user &&
    tokens.accessToken.trim() &&
    tokens.refreshToken.trim()
  );
}

export async function persistMobileSession(
  tokens: MobileTokens,
  dependencies: Pick<
    MobileSessionDependencies,
    'cacheUser' | 'clearAuthStorage' | 'setActiveToken' | 'storeRefreshToken'
  >
): Promise<SessionState> {
  if (!validTokens(tokens)) {
    dependencies.setActiveToken(null);
    await dependencies.clearAuthStorage();
    return signedOutSession();
  }

  try {
    await dependencies.storeRefreshToken(tokens.refreshToken);
    await dependencies.cacheUser(tokens.user);
    dependencies.setActiveToken(tokens.accessToken);
    return authenticatedSession(tokens.user, tokens.accessToken);
  } catch {
    dependencies.setActiveToken(null);
    await dependencies.clearAuthStorage();
    return signedOutSession();
  }
}

export async function restoreMobileSession(
  dependencies: MobileSessionDependencies
): Promise<SessionState> {
  const refreshToken = await dependencies.loadRefreshToken();
  if (!refreshToken) {
    dependencies.setActiveToken(null);
    return signedOutSession();
  }

  try {
    const tokens = await dependencies.refresh(refreshToken);
    return await persistMobileSession(tokens, dependencies);
  } catch {
    dependencies.setActiveToken(null);
    await dependencies.clearAuthStorage();
    return signedOutSession();
  }
}

export async function clearMobileSession(
  userId: string | undefined,
  dependencies: Pick<
    MobileSessionDependencies,
    'clearAuthStorage' | 'clearNotebookCache' | 'setActiveToken'
  >
): Promise<SessionState> {
  dependencies.setActiveToken(null);
  await Promise.allSettled([
    dependencies.clearAuthStorage(),
    ...(userId ? [dependencies.clearNotebookCache(userId)] : []),
  ]);
  return signedOutSession();
}
