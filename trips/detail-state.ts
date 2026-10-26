// What Trip detail should show, decided from the Trips provider's state alone.
//
// 'trip'      the Trip is known: render it now, whatever else is still loading
// 'loading'   nothing is known yet, or this Trip is not known while a refresh could
//             still find it: the one case that gets a full-screen indicator
// 'notFound'  loading has finished and the Trip is not there (deleted, or not this
//             account's)
// Editorial Place cards never appear in this decision: they arrive after the Trip is
// already on screen.
export type TripDetailView = 'loading' | 'notFound' | 'trip';

export function tripDetailView({
  hasTrip,
  isLoading,
  isRefreshing,
}: {
  hasTrip: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
}): TripDetailView {
  if (isLoading) return 'loading';
  if (hasTrip) return 'trip';
  return isRefreshing ? 'loading' : 'notFound';
}
