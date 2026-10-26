// Motion rules for the Map Places tray: three states (minimised, peek, full) and the
// numbers behind the transitions between them. Kept free of React Native so the
// state changes and geometry can be tested directly.

export type MapTrayState = 'minimised' | 'peek' | 'full';

/** Duration of every tray transition (ease-in-out), in milliseconds. */
export const TRAY_ANIMATION_MS = 500;

/** Height of the tray when minimised: top padding + one 44 pt header row + bottom padding. */
export const COLLAPSED_SHEET_HEIGHT = 64;

/** The up arrow: minimised opens the peek tray, otherwise the full list. */
export const trayAfterUpArrow = (current: MapTrayState): MapTrayState =>
  current === 'minimised' ? 'peek' : 'full';

/** The down arrow in the peek tray minimises it. */
export const trayAfterDownArrow = (): MapTrayState => 'minimised';

/** Where the tray's own progress (0 minimised, 1 expanded) is heading for a state. */
export const sheetProgressTarget = (state: MapTrayState): 0 | 1 => (state === 'minimised' ? 0 : 1);

/** Where the full-list overlay's progress (0 hidden, 1 covering the map) is heading. */
export const overlayProgressTarget = (state: MapTrayState): 0 | 1 => (state === 'full' ? 1 : 0);

/** Tray height at a point in the transition. Runs on the UI thread. */
export function sheetHeightAtProgress(progress: number, expandedHeight: number): number {
  'worklet';
  return COLLAPSED_SHEET_HEIGHT + (expandedHeight - COLLAPSED_SHEET_HEIGHT) * progress;
}

/**
 * The tray height the rest of the screen should plan around (camera padding, marker
 * reveal): the height it settles at, never an in-between value.
 */
export const settledSheetHeight = (state: MapTrayState, expandedHeight: number): number =>
  state === 'minimised' ? COLLAPSED_SHEET_HEIGHT : expandedHeight;
