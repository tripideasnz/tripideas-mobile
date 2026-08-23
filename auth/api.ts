import { apiFetch, API_BASE_URL } from '@/lib/api-client';
import type { AuthUser } from '@/auth/session';

type IdentityResponse = { id: string; email: string; name: string | null };

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const identity = await apiFetch<IdentityResponse | undefined>('/auth/identity');
    if (!identity?.id) return null;
    return { id: identity.id, email: identity.email, name: identity.name ?? undefined };
  } catch {
    return null;
  }
}

export async function signOutFromServer(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, { credentials: 'include' });
  } catch { /* ignore */ }
}

type MobileAuthorizeResponse = { url: string };

export async function mobileAuthorize(
  codeChallenge: string
): Promise<MobileAuthorizeResponse> {
  return apiFetch<MobileAuthorizeResponse>('/auth/mobile/authorize', {
    method: 'POST',
    body: JSON.stringify({ codeChallenge, codeChallengeMethod: 'S256' }),
  });
}

type WorkOSUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  user: WorkOSUser | null;
};

export type MobileExchangeStage =
  | 'workos_exchange'
  | 'user_reconciliation'
  | 'unexpected';

export class MobileExchangeError extends Error {
  readonly code = 'mobile_exchange_failed';

  constructor(readonly stage: MobileExchangeStage) {
    super('Mobile token exchange failed');
    this.name = 'MobileExchangeError';
  }
}

function safeExchangeStage(responseText: string): MobileExchangeStage {
  try {
    const body = JSON.parse(responseText) as {
      error?: { code?: unknown; stage?: unknown };
    };
    if (
      body.error?.code === 'mobile_exchange_failed' &&
      (body.error.stage === 'workos_exchange' ||
        body.error.stage === 'user_reconciliation' ||
        body.error.stage === 'unexpected')
    ) {
      return body.error.stage;
    }
  } catch {
    // The response is deliberately collapsed to a safe internal category.
  }
  return 'unexpected';
}

export function mapTokenUser(workosUser: WorkOSUser | null | undefined): AuthUser | null {
  if (!workosUser?.id || !workosUser?.email) return null;
  const nameParts = [workosUser.firstName, workosUser.lastName].filter(Boolean);
  return {
    id: workosUser.id,
    email: workosUser.email,
    name: nameParts.length > 0 ? nameParts.join(' ') : undefined,
  };
}

export async function mobileExchange(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/mobile/exchange`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new MobileExchangeError(safeExchangeStage(responseText));
  }

  return JSON.parse(responseText) as TokenResponse;
}

export async function mobileRefresh(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/mobile/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new MobileRefreshError(response.status);
  }

  return response.json() as Promise<TokenResponse>;
}

export class MobileRefreshError extends Error {
  constructor(public readonly status: number) {
    super('Mobile token refresh request failed');
    this.name = 'MobileRefreshError';
  }
}
