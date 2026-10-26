export type MapContentSelection =
  | { type: 'all' }
  | { label: string; regionId: string; type: 'region' }
  | { label: string; subRegionId: string; type: 'subregion' }
  | { type: 'favourites' }
  | { label: string; tripId: string; type: 'trip' };

/**
 * The selection after "Clear" in the Regions sheet. Only a geographical scope
 * (region or sub-region) is cleared; saved scopes (favourites, a trip) and 'all'
 * are returned unchanged, so the same object means "nothing to do".
 */
export function clearRegionScope(selection: MapContentSelection): MapContentSelection {
  return selection.type === 'region' || selection.type === 'subregion' ? { type: 'all' } : selection;
}
