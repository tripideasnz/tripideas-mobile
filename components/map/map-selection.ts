export type MapContentSelection =
  | { type: 'all' }
  | { label: string; regionId: string; type: 'region' }
  | { label: string; subRegionId: string; type: 'subregion' }
  | { type: 'favourites' }
  | { label: string; tripId: string; type: 'trip' };
