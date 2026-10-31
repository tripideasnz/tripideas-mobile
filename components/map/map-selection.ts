export type MapContentSelection =
  | { type: 'all' }
  | { label: string; regionId: string; type: 'region' }
  | { label: string; subRegionId: string; type: 'subregion' }
  | { type: 'favourites' }
  | { label: string; tripId: string; type: 'trip' };

export function isSameSelection(left: MapContentSelection, right: MapContentSelection) {
  if (left.type !== right.type) return false;
  if (left.type === 'region' && right.type === 'region') return left.regionId === right.regionId;
  if (left.type === 'subregion' && right.type === 'subregion') return left.subRegionId === right.subRegionId;
  if (left.type === 'trip' && right.type === 'trip') return left.tripId === right.tripId;
  return true;
}

/** True when two sets of activity ids hold the same activities, in any order. */
export function isSameActivitySelection(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/**
 * What a tap in a filter sheet leaves selected: choosing the current scope again
 * deselects it (back to everything); choosing another replaces it. A single scope
 * at a time, exactly as before; whether the sheet then stays open is the caller's.
 */
export function resolveSelection(current: MapContentSelection, next: MapContentSelection): MapContentSelection {
  return isSameSelection(current, next) ? { type: 'all' } : next;
}

/**
 * The selection after "Clear" in the Regions sheet. Only a geographical scope
 * (region or sub-region) is cleared; saved scopes (favourites, a trip) and 'all'
 * are returned unchanged, so the same object means "nothing to do".
 */
export function clearRegionScope(selection: MapContentSelection): MapContentSelection {
  return selection.type === 'region' || selection.type === 'subregion' ? { type: 'all' } : selection;
}
