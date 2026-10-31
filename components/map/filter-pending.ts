// The pending (staged) selections of the Regions and Activities filters. Both sheets stage their
// choices and tell the Map only on Apply; these are the transitions the sheets use, kept apart so
// they can be tested without a screen. The selection rules differ on purpose: Regions is one region
// or sub-region at a time, Activities is any number.
import { clearRegionScope, resolveSelection, type MapContentSelection } from '@/components/map/map-selection';

/** Regions: choosing another replaces the pending region; choosing it again clears it. */
export const chooseRegion = (pending: MapContentSelection, chosen: MapContentSelection): MapContentSelection =>
  resolveSelection(pending, chosen);

/** Regions: Clear empties the pending region or sub-region (saved scopes are not regions and stay). */
export const clearPendingRegions = (pending: MapContentSelection): MapContentSelection => clearRegionScope(pending);

/** Activities: each choice toggles on its own, so any number can be pending. */
export const toggleActivity = (pending: readonly string[], tagId: string): string[] =>
  pending.includes(tagId) ? pending.filter((id) => id !== tagId) : [...pending, tagId];

/** Activities: Clear empties every pending choice. */
export const clearPendingActivities = (): string[] => [];
