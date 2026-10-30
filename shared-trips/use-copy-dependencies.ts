// The dependencies of the existing Save workflow (trips/shared-trip-save.ts), wired to the real API
// and device, shared by the two screens that can Save a Copy of a live Shared Trip. They are the same
// ones app/trip/[shareId].tsx uses for a web snapshot, so both copy flows behave identically.
import * as Crypto from 'expo-crypto';
import { useMemo, useRef } from 'react';

import { checkApiCapability } from '@/lib/api-compatibility';
import { importSharedTripRequest, listTripSummaries } from '@/trips/api';
import { useMyTrips } from '@/trips/provider';
import { createAsyncStorageAttemptStore } from '@/trips/shared-trip-attempts';
import { IMPORT_CAPABILITY, type SaveDependencies } from '@/trips/shared-trip-save';

const attemptStore = createAsyncStorageAttemptStore();

export function useCopyDependencies(): SaveDependencies {
  const { refreshAfterServerChange } = useMyTrips();
  const refreshRef = useRef(refreshAfterServerChange);
  refreshRef.current = refreshAfterServerChange;
  return useMemo<SaveDependencies>(
    () => ({
      checkCapability: () => checkApiCapability(IMPORT_CAPABILITY),
      importTrip: importSharedTripRequest,
      listOwnTripIds: async () => (await listTripSummaries()).map((summary) => summary.id),
      newId: () => Crypto.randomUUID(),
      now: () => Date.now(),
      refreshTrips: () => refreshRef.current(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      store: attemptStore,
    }),
    []
  );
}
