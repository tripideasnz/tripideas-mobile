import { useCallback, useState } from 'react';

export const nextMapSelectionAction = (selectedId: string | null, nextId: string) => selectedId === nextId ? 'open' : 'select';

export function useMapSelection<T>(onOpen: (value: T) => void) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activate = useCallback((id: string, value: T) => {
    if (nextMapSelectionAction(selectedId, id) === 'open') { onOpen(value); return 'open' as const; }
    setSelectedId(id); return 'select' as const;
  }, [onOpen, selectedId]);
  return { activate, clear: useCallback(() => setSelectedId(null), []), select: setSelectedId, selectedId };
}
