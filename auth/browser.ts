import type { WebBrowserAuthSessionResult } from 'expo-web-browser';

export type AuthBrowserOutcome =
  | { status: 'success'; url: string }
  | {
      status: 'cancelled';
      category: 'already-open' | 'cancel' | 'dismiss';
    }
  | {
      status: 'failed';
      category: 'invalid-url' | 'unavailable' | 'unknown';
    };

type ErrorWithCode = {
  code?: unknown;
};

const expectedCancellationCodes = new Set([
  'ERR_CANCELED',
  'ERR_CANCELLED',
  'ERR_WEB_BROWSER_CANCELED',
  'ERR_WEB_BROWSER_CANCELLED',
]);

function safeErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as ErrorWithCode).code;
  return typeof code === 'string' ? code : null;
}

export function classifyAuthBrowserError(error: unknown): AuthBrowserOutcome {
  const code = safeErrorCode(error);

  if (code && expectedCancellationCodes.has(code)) {
    return { status: 'cancelled', category: 'cancel' };
  }
  if (code === 'ERR_WEB_BROWSER_ALREADY_OPEN') {
    return { status: 'cancelled', category: 'already-open' };
  }
  if (code === 'ERR_WEB_BROWSER_INVALID_URL') {
    return { status: 'failed', category: 'invalid-url' };
  }
  if (code === 'ERR_UNAVAILABLE') {
    return { status: 'failed', category: 'unavailable' };
  }
  return { status: 'failed', category: 'unknown' };
}

export async function openAuthBrowserSafely(
  open: () => Promise<WebBrowserAuthSessionResult>
): Promise<AuthBrowserOutcome> {
  let result: WebBrowserAuthSessionResult;
  try {
    result = await open();
  } catch (error) {
    return classifyAuthBrowserError(error);
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { status: 'cancelled', category: result.type };
  }
  if (result.type === 'success') {
    return { status: 'success', url: result.url };
  }
  return { status: 'failed', category: 'unknown' };
}

export function authBrowserFailureMessage(
  outcome: AuthBrowserOutcome,
  hasAuthenticatedUser: boolean
): string | null {
  if (outcome.status !== 'failed' || hasAuthenticatedUser) return null;
  return 'Sign-in could not open. Please try again.';
}
