import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import {
  mapTokenUser,
  mobileAuthorize,
  mobileExchange,
  mobileRefresh,
} from '@/auth/api';
import {
  authenticatedSession,
  clearMobileSession,
  persistMobileSession,
  restoreMobileSession,
  runCoalescedRefresh,
  selectRefreshUser,
} from '@/auth/mobile-session';
import { generateCodeChallenge, generateCodeVerifier } from '@/auth/pkce';
import { clearAuthStorage } from '@/auth/storage';
import {
  setActiveToken,
  setAuthenticatedSessionHandlers,
} from '@/lib/api-client';
import { clearNotebookCache } from '@/notebooks/storage';
import type { AuthContextValue, AuthUser, SessionState } from '@/auth/session';
import {
  CODE_VERIFIER_KEY,
  EXPECTED_STATE_KEY,
  initialSessionState,
  REFRESH_TOKEN_KEY,
  USER_SECURE_KEY,
} from '@/auth/session';

const AuthContext = createContext<AuthContextValue | null>(null);

const MOBILE_REDIRECT_URI = 'tripideas://auth/callback';

// ─── SecureStore helpers ──────────────────────────────────────────────────────

async function loadCachedUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_SECURE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

async function cacheUser(user: AuthUser | null): Promise<void> {
  try {
    if (user) {
      await SecureStore.setItemAsync(USER_SECURE_KEY, JSON.stringify(user));
    } else {
      await SecureStore.deleteItemAsync(USER_SECURE_KEY);
    }
  } catch { /* non-critical */ }
}

async function storeRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

async function loadRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function storeCodeVerifier(verifier: string, expectedState: string): Promise<void> {
  await SecureStore.setItemAsync(CODE_VERIFIER_KEY, verifier);
  await SecureStore.setItemAsync(EXPECTED_STATE_KEY, expectedState);
}

export async function consumeCodeVerifier(): Promise<{ verifier: string; expectedState: string } | null> {
  try {
    const verifier = await SecureStore.getItemAsync(CODE_VERIFIER_KEY);
    const expectedState = await SecureStore.getItemAsync(EXPECTED_STATE_KEY);
    await SecureStore.deleteItemAsync(CODE_VERIFIER_KEY);
    await SecureStore.deleteItemAsync(EXPECTED_STATE_KEY);
    if (!verifier || !expectedState) return null;
    return { verifier, expectedState };
  } catch {
    return null;
  }
}

// ─── Callback URL parsing ─────────────────────────────────────────────────────

type ParsedCallback =
  | { ok: true; code: string; state: string | null }
  | { ok: false; reason: string };

function parseCallbackUrl(raw: string): ParsedCallback {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.error('[Auth] Callback validation failed: invalid callback URL.');
    return { ok: false, reason: 'Invalid callback URL' };
  }

  const error = url.searchParams.get('error');
  if (error) {
    console.error('[Auth] Callback validation failed: provider returned an error.');
    return { ok: false, reason: 'Provider returned an error' };
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) return { ok: false, reason: 'Missing "code" in callback URL' };
  if (!state) console.warn('[Auth] state missing from callback URL — skipping state verification');

  return { ok: true, code, state };
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>(initialSessionState);
  const [authError, setAuthError] = useState<string | null>(null);
  const hasAuthenticatedUserRef = useRef(false);
  const isRestoringRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);

  const restoreSession = useCallback(async () => {
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;

    try {
      const restored = await restoreMobileSession({
        cacheUser,
        clearAuthStorage,
        clearNotebookCache,
        loadRefreshToken,
        refresh: async (refreshToken) => {
          const result = await mobileRefresh(refreshToken);
          return {
            ...result,
            user: selectRefreshUser(
              mapTokenUser(result.user),
              await loadCachedUser()
            ),
          };
        },
        setActiveToken,
        storeRefreshToken,
      });
      hasAuthenticatedUserRef.current = Boolean(restored.session);
      if (restored.session) setAuthError(null);
      setState(restored);
    } catch {
      setActiveToken(null);
      await clearAuthStorage();
      hasAuthenticatedUserRef.current = false;
      setState(authenticatedSession(null, ''));
    } finally {
      isRestoringRef.current = false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) await restoreSession();
    })();
    return () => { isMounted = false; };
  }, [restoreSession]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void restoreSession();
    });
    return () => sub.remove();
  }, [restoreSession]);

  useEffect(() => {
    if (!state.user) return;
    hasAuthenticatedUserRef.current = true;
    if (authError) setAuthError(null);
  }, [authError, state.user]);

  const acceptMobileTokens = useCallback(async (tokens: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser | null;
  }) => {
    const nextState = await persistMobileSession(tokens, {
      cacheUser,
      clearAuthStorage,
      setActiveToken,
      storeRefreshToken,
    });
    hasAuthenticatedUserRef.current = Boolean(nextState.session);
    if (nextState.session) setAuthError(null);
    setState(nextState);
    return Boolean(nextState.session);
  }, []);

  const signIn = useCallback(async () => {
    setAuthError(null);
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    let authorizationUrl: string;
    try {
      const response = await mobileAuthorize(codeChallenge);
      authorizationUrl = response.url;
    } catch {
      console.error('[Auth] Authorize request failed.');
      setAuthError('Sign-in could not start. Please try again later.');
      return;
    }

    let expectedState: string | null = null;
    try {
      const authUrl = new URL(authorizationUrl);
      const redirectUri = authUrl.searchParams.get('redirect_uri');
      expectedState = authUrl.searchParams.get('state');
      if (redirectUri !== MOBILE_REDIRECT_URI) {
        console.error('[Auth] Backend redirect URI configuration mismatch.');
      }
    } catch {
      console.warn('[Auth] Could not inspect authorization URL');
    }

    if (expectedState) {
      await storeCodeVerifier(codeVerifier, expectedState);
    }

    let result: WebBrowser.WebBrowserAuthSessionResult;
    try {
      result = await WebBrowser.openAuthSessionAsync(authorizationUrl, MOBILE_REDIRECT_URI);
    } catch {
      console.error('[Auth] Auth browser failed.');
      if (hasAuthenticatedUserRef.current) {
        setAuthError(null);
        return;
      }
      setAuthError('Sign-in could not open. Please try again.');
      await clearAuthStorage();
      return;
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      if (hasAuthenticatedUserRef.current) {
        setAuthError(null);
        return;
      }
      await clearAuthStorage();
      return;
    }

    if (result.type !== 'success') {
      console.warn('[Auth] Auth browser returned an unexpected result.');
      if (hasAuthenticatedUserRef.current) {
        setAuthError(null);
        return;
      }
      setAuthError('Sign-in did not complete. Please try again.');
      await clearAuthStorage();
      return;
    }

    const parsed = parseCallbackUrl(result.url);

    if (!parsed.ok) {
      if (hasAuthenticatedUserRef.current) {
        setAuthError(null);
        return;
      }
      console.warn('[Auth] Callback validation failed.');
      setAuthError('Sign-in did not complete. Please try again.');
      await clearAuthStorage();
      return;
    }

    if (parsed.state && expectedState && parsed.state !== expectedState) {
      console.error('[Auth] State mismatch. Aborting.');
      if (hasAuthenticatedUserRef.current) {
        setAuthError(null);
        return;
      }
      setAuthError('Sign-in could not be verified. Please try again.');
      await clearAuthStorage();
      return;
    }
    if (!parsed.state || !expectedState) {
      console.warn('[Auth] State verification skipped');
    }

    let tokens;
    try {
      tokens = await mobileExchange(parsed.code, codeVerifier);
    } catch (error) {
      const stage =
        error instanceof Error && 'stage' in error
          ? String(error.stage)
          : 'unexpected';
      console.error(`[Auth] Token exchange failed at safe stage: ${stage}.`);
      if (hasAuthenticatedUserRef.current) {
        setAuthError(null);
        return;
      }
      setAuthError('Sign-in could not be completed. Please try again later.');
      setActiveToken(null);
      await clearAuthStorage();
      setState(authenticatedSession(null, ''));
      return;
    }

    const user = mapTokenUser(tokens.user);
    await acceptMobileTokens({ ...tokens, user });
  }, [acceptMobileTokens]);

  const signOut = useCallback(async () => {
    // TODO: Call POST /auth/mobile/logout once backend implements it.
    // Until then, sign-out is local-only. The WorkOS hosted session remains
    // active, so re-signing in immediately will skip the WorkOS UI.
    const signedOutUserId = state.session?.userId ?? state.user?.id;
    const nextState = await clearMobileSession(signedOutUserId, {
      clearAuthStorage,
      clearNotebookCache,
      setActiveToken,
    });
    hasAuthenticatedUserRef.current = false;
    setAuthError(null);
    setState(nextState);
  }, [state.session?.userId, state.user?.id]);

  const refreshBearer = useCallback(() => {
    return runCoalescedRefresh(refreshInFlightRef, async () => {
      const restored = await restoreMobileSession({
        cacheUser,
        clearAuthStorage,
        clearNotebookCache,
        loadRefreshToken,
        refresh: async (refreshToken) => {
          const result = await mobileRefresh(refreshToken);
          return {
            ...result,
            user: selectRefreshUser(
              mapTokenUser(result.user),
              state.user ?? await loadCachedUser()
            ),
          };
        },
        setActiveToken,
        storeRefreshToken,
      });

      if (!restored.session) {
        const signedOutUserId = state.session?.userId ?? state.user?.id;
        const signedOut = await clearMobileSession(signedOutUserId, {
          clearAuthStorage,
          clearNotebookCache,
          setActiveToken,
        });
        hasAuthenticatedUserRef.current = false;
        setState(signedOut);
        return false;
      }

      hasAuthenticatedUserRef.current = true;
      setAuthError(null);
      setState(restored);
      return true;
    });
  }, [state.session?.userId, state.user?.id]);

  useEffect(() => {
    setAuthenticatedSessionHandlers({
      invalidate: signOut,
      refresh: refreshBearer,
    });
    return () => setAuthenticatedSessionHandlers(null);
  }, [refreshBearer, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, acceptMobileTokens, authError, signIn, signOut }),
    [state, acceptMobileTokens, authError, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useSession must be used inside AuthProvider.');
  return context;
}
