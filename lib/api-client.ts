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

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_activeToken) {
    headers['Authorization'] = `Bearer ${_activeToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  // Some endpoints (e.g. POST/DELETE /favourite) return a 200 with an empty
  // body. response.json() throws on empty input, so parse manually.
  const responseText = await response.text();
  return (responseText ? JSON.parse(responseText) : undefined) as T;
}
