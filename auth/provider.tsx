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
  getCurrentUser,
  mapTokenUser,
  mobileAuthorize,
  mobileExchange,
  mobileRefresh,
} from '@/auth/api';
import { generateCodeChallenge, generateCodeVerifier } from '@/auth/pkce';
import { clearAuthStorage } from '@/auth/storage';
import { setActiveToken } from '@/lib/api-client';
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

// ─── Session state helpers ────────────────────────────────────────────────────

function userToSession(user: AuthUser | null, accessToken = ''): SessionState {
  return user
    ? { isLoading: false, session: { userId: user.id, accessToken }, user }
    : { isLoading: false, session: null, user: null };
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

  const restoreSession = useCallback(async () => {
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;

    try {
      const storedRefreshToken = await loadRefreshToken();

      if (storedRefreshToken) {
        try {
          const result = await mobileRefresh(storedRefreshToken);
          setActiveToken(result.accessToken);
          await storeRefreshToken(result.refreshToken);
          const user = mapTokenUser(result.user);
          await cacheUser(user);
          hasAuthenticatedUserRef.current = Boolean(user);
          if (user) setAuthError(null);
          setState(userToSession(user, result.accessToken));
          return;
        } catch {
          // Refresh token expired or revoked.
          console.warn('[Auth] restoreSession refresh failed — clearing auth storage');
          await clearAuthStorage();
          setActiveToken(null);
        }
      }

      // Cookie-based fallback.
      const user = await getCurrentUser();
      await cacheUser(user);
      hasAuthenticatedUserRef.current = Boolean(user);
      if (user) setAuthError(null);
      setState(userToSession(user));
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    } finally {
      isRestoringRef.current = false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const cached = await loadCachedUser();
      if (isMounted && cached) setState((prev) => ({ ...prev, user: cached, isLoading: true }));
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
    } catch {
      console.error('[Auth] Token exchange failed.');
      if (hasAuthenticatedUserRef.current) {
        setAuthError(null);
        return;
      }
      setAuthError('Sign-in could not be completed. Please try again later.');
      await clearAuthStorage();
      return;
    }

    setActiveToken(tokens.accessToken);
    await storeRefreshToken(tokens.refreshToken);
    const user = mapTokenUser(tokens.user);
    await cacheUser(user);
    hasAuthenticatedUserRef.current = Boolean(user);
    if (user) setAuthError(null);
    setState(userToSession(user, tokens.accessToken));
  }, []);

  const signOut = useCallback(async () => {
    // TODO: Call POST /auth/mobile/logout once backend implements it.
    // Until then, sign-out is local-only. The WorkOS hosted session remains
    // active, so re-signing in immediately will skip the WorkOS UI.
    setActiveToken(null);
    const signedOutUserId = state.session?.userId ?? state.user?.id;
    if (signedOutUserId) {
      try {
        await clearNotebookCache(signedOutUserId);
      } catch {
        console.warn('[Notebooks] cache cleanup failed during sign-out.');
      }
    }
    await clearAuthStorage();
    hasAuthenticatedUserRef.current = false;
    setAuthError(null);
    setState({ isLoading: false, session: null, user: null });
  }, [state.session?.userId, state.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, authError, signIn, signOut }),
    [state, authError, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useSession must be used inside AuthProvider.');
  return context;
}
