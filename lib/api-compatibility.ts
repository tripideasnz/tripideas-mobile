import { API_BASE_URL } from './api-client';

export const REQUIRED_MOBILE_API_CAPABILITIES = [
  'notebooks',
  'personal-place-cards',
  'photo-assets',
  'mixed-itineraries',
  'trip-api-authority',
  'notebook-link-blocks',
  'notebook-rich-block-metadata',
  'notebook-explicit-location',
] as const;

export type ApiCompatibility =
  | { status: 'compatible'; build: string; environment: string }
  | { status: 'incompatible'; reason: 'identity-missing' | 'capability-missing' | 'version-mismatch' }
  | { status: 'unreachable' };

type ApiIdentity = {
  apiVersion?: unknown;
  build?: unknown;
  capabilities?: unknown;
  environment?: unknown;
};

export async function checkApiCompatibility(
  fetcher: typeof fetch = fetch
): Promise<ApiCompatibility> {
  let response: Response;
  try {
    response = await fetcher(`${API_BASE_URL}/version`);
  } catch {
    return { status: 'unreachable' };
  }

  if (response.status === 404) {
    return { status: 'incompatible', reason: 'identity-missing' };
  }
  if (!response.ok) return { status: 'unreachable' };

  let identity: ApiIdentity;
  try {
    identity = (await response.json()) as ApiIdentity;
  } catch {
    return { status: 'incompatible', reason: 'identity-missing' };
  }

  if (identity.apiVersion !== 1) {
    return { status: 'incompatible', reason: 'version-mismatch' };
  }
  const capabilities = Array.isArray(identity.capabilities)
    ? identity.capabilities
    : [];
  if (
    !REQUIRED_MOBILE_API_CAPABILITIES.every((capability) =>
      capabilities.includes(capability)
    )
  ) {
    return { status: 'incompatible', reason: 'capability-missing' };
  }
  if (
    typeof identity.build !== 'string' ||
    typeof identity.environment !== 'string'
  ) {
    return { status: 'incompatible', reason: 'identity-missing' };
  }

  return {
    status: 'compatible',
    build: identity.build,
    environment: identity.environment,
  };
}

export function isRouteUnavailableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'code' in error &&
    error.status === 404 &&
    (error.code === 'NOT_FOUND' || error.code === 'request_failed')
  );
}
