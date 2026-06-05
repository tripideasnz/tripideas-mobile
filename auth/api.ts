import type { AuthSession, AuthUser } from '@/auth/session';

export async function getCurrentUser(
  _session: AuthSession | null
): Promise<AuthUser | null> {
  // TODO: Wire this to the TripIdeas website identity API.
  return null;
}

export async function signOut(): Promise<void> {
  // TODO: Clear secure mobile session storage once auth is implemented.
}
