// Keeps the Shared Trips store in step with the signed-in account, for the whole app. A different
// account (or signing out) clears everything the previous account could see; the same account keeps
// its data. Renders nothing.
import { useEffect } from 'react';

import { useSession } from '@/auth/provider';
import { sharedTripsStore } from '@/shared-trips';

export function SharedTripsSessionBinder() {
  const { isLoading, session } = useSession();
  const userId = session?.userId ?? null;
  useEffect(() => {
    // While the session is still being restored there is nothing to decide yet.
    if (!isLoading) sharedTripsStore.setSession(userId);
  }, [isLoading, userId]);
  return null;
}
