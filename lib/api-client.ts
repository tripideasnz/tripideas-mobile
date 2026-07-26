export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.tripideas.nz';

// Set by AuthProvider when a token is acquired or cleared.
let _activeToken: string | null = null;
type AuthenticatedSessionHandlers = {
  invalidate: () => Promise<void>;
  refresh: () => Promise<boolean>;
};
let _authenticatedSessionHandlers: AuthenticatedSessionHandlers | null = null;

export function setActiveToken(token: string | null): void {
  _activeToken = token;
}

export function setAuthenticatedSessionHandlers(
  handlers: AuthenticatedSessionHandlers | null
): void {
  _authenticatedSessionHandlers = handlers;
}

export function getSignInUrl(): string {
  return `${API_BASE_URL}/auth/authenticate`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = 'The request could not be completed.'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseError(responseText: string): { code?: string; message?: string } {
  if (!responseText) return {};

  try {
    const parsed = JSON.parse(responseText) as {
      error?: { code?: unknown; message?: unknown };
    };
    return {
      code: typeof parsed.error?.code === 'string' ? parsed.error.code : undefined,
      message:
        typeof parsed.error?.message === 'string'
          ? parsed.error.message
          : undefined,
    };
  } catch {
    return {};
  }
}

type ApiResponse = {
  response: Response;
  responseText: string;
};

async function performRequest(
  path: string,
  options?: RequestInit
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (options?.body != null) {
    headers['Content-Type'] = 'application/json';
  }
  if (_activeToken) {
    headers['Authorization'] = `Bearer ${_activeToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  // Some endpoints (e.g. POST/DELETE /favourite) return a 200 with an empty
  // body. response.json() throws on empty input, so parse manually.
  const responseText = await response.text();
  return { response, responseText };
}

function parseResponse<T>({ response, responseText }: ApiResponse): T {
  if (!response.ok) {
    const error = parseError(responseText);
    throw new ApiError(
      response.status,
      error.code ?? 'request_failed',
      error.message
    );
  }

  if (!responseText) return undefined as T;

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new ApiError(500, 'malformed_response');
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  return parseResponse<T>(await performRequest(path, options));
}

function hasReplayableBody(options?: RequestInit): boolean {
  const body = options?.body;
  return (
    body == null ||
    typeof body === 'string' ||
    body instanceof URLSearchParams
  );
}

export async function authenticatedApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  if (!_activeToken) {
    throw new ApiError(401, 'mobile_session_required', 'Please sign in again.');
  }
  const first = await performRequest(path, options);
  if (
    first.response.status !== 401 ||
    !_authenticatedSessionHandlers ||
    !hasReplayableBody(options)
  ) {
    return parseResponse<T>(first);
  }

  const refreshed = await _authenticatedSessionHandlers.refresh();
  if (!refreshed) return parseResponse<T>(first);

  const retry = await performRequest(path, options);
  if (retry.response.status === 401) {
    await _authenticatedSessionHandlers.invalidate();
  }
  return parseResponse<T>(retry);
}
