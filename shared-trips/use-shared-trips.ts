// React binding for the Shared Trips store. It only subscribes; it has no UI and no navigation.
import { useSyncExternalStore } from 'react';

import { sharedTripsStore } from '@/shared-trips';
import type { SharedTripsState } from '@/shared-trips/store';

export function useSharedTripsState(): SharedTripsState {
  return useSyncExternalStore(sharedTripsStore.subscribe, sharedTripsStore.getState);
}
