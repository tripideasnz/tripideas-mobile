import { useCallback, useState } from 'react';

export const nextMapSelectionAction = (selectedId: string | null, nextId: string) => selectedId === nextId ? 'open' : 'select';

export type PlaceTapSource = 'marker' | 'thumbnail';
export type PlaceTapPlan = {
  action: 'open' | 'select';
  selectedId: string;
  /** What follows a first tap: a marker is brought clear of the controls, a thumbnail's marker is centred and zoomed to. */
  then: 'focus' | 'open' | 'reveal';
};

/**
 * The two-stage rule for the Map's Places: the first tap on a marker or a tray thumbnail
 * selects that Place (replacing any other) and stays on the Map; a tap on the Place that
 * is already selected opens it. Markers and thumbnails share one selected id, so they
 * always agree.
 */
export function planPlaceTap(selectedId: string | null, id: string, source: PlaceTapSource): PlaceTapPlan {
  if (nextMapSelectionAction(selectedId, id) === 'open') return { action: 'open', selectedId: id, then: 'open' };
  return { action: 'select', selectedId: id, then: source === 'marker' ? 'reveal' : 'focus' };
}

export function useMapSelection<T>(onOpen: (value: T) => void) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activate = useCallback((id: string, value: T) => {
    if (nextMapSelectionAction(selectedId, id) === 'open') { onOpen(value); return 'open' as const; }
    setSelectedId(id); return 'select' as const;
  }, [onOpen, selectedId]);
  return { activate, clear: useCallback(() => setSelectedId(null), []), select: setSelectedId, selectedId };
}
