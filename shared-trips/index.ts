// The app-wide Shared Trips store, wired to the real API clients. Screens (a later stage) use it through
// use-shared-trips.ts; tests build their own store with fake dependencies.
import { checkSharedTripsCapability } from '@/shared-trips/api';
import * as api from '@/shared-trips/api';
import { createSharedTripsStore } from '@/shared-trips/store';

export const sharedTripsStore = createSharedTripsStore({
  checkCapability: checkSharedTripsCapability,
  deleteCollectionNote: api.deleteCollectionNote,
  deletePlaceNote: api.deletePlaceNote,
  getSharedTrip: api.getSharedTrip,
  joinSharedTrip: api.joinSharedTrip,
  leaveSharedTrip: api.leaveSharedTrip,
  listOwnedTrips: api.listOwnedTrips,
  listSharedTrips: api.listSharedTrips,
  now: Date.now,
  saveCollectionNote: api.saveCollectionNote,
  savePlaceNote: api.savePlaceNote,
  shareTrip: api.shareTrip,
  updateCollectionNote: api.updateCollectionNote,
  updatePlaceNote: api.updatePlaceNote,
});
