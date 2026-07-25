export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.tripideas.nz';

// Set by AuthProvider when a token is acquired or cleared.
let _activeToken: string | null = null;
export function setActiveToken(token: string | null): void {
  _activeToken = token;
}

export function getSignInUrl(): string {
  return `${API_BASE_URL}/auth/authenticate`;
}

function hasJsonBody(body: BodyInit | null | undefined): boolean {
  if (typeof body !== 'string') {
    return false;
  }

  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

export function buildApiHeaders(
  options?: RequestInit,
  token: string | null = _activeToken
): Headers {
  const headers = new Headers(options?.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (
    hasJsonBody(options?.body) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: buildApiHeaders(options),
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  // Some endpoints (e.g. POST/DELETE /favourite) return a 200 with an empty
  // body. response.json() throws on empty input, so parse manually.
  const responseText = await response.text();
  return (responseText ? JSON.parse(responseText) : undefined) as T;
}
