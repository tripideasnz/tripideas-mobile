import { useCallback, useMemo, useReducer } from 'react';

import { foregroundLocation, type ForegroundPoint, type LocationFix } from '@/location/foreground';
import {
  initialLocateState,
  isLocateBusy,
  locateReducer,
  locateStatus,
} from '@/location/locate-flow';
import { createSingleFlight } from '@/location/single-flight';

/**
 * "Locate now" for a Personal Place. A fresh fix is saved straight away (the
 * tap is the confirmation); a cached position is only offered for confirmation.
 * `save` persists through the existing API path, so server validation applies.
 */
export function useLocateNow({
  describeSaveError,
  save,
}: {
  describeSaveError: (error: unknown) => string;
  save: (point: ForegroundPoint) => Promise<unknown>;
}) {
  const [state, dispatch] = useReducer(locateReducer, initialLocateState);
  const flight = useMemo(() => createSingleFlight(), []);

  const persist = useCallback(
    async (point: ForegroundPoint, approximate: boolean) => {
      dispatch({ type: 'save-started' });
      try {
        await save(point);
        dispatch({ approximate, type: 'saved' });
      } catch (error) {
        dispatch({ message: describeSaveError(error), type: 'save-failed' });
      }
    },
    [describeSaveError, save]
  );

  const locate = useCallback(async () => {
    await flight.run(async () => {
      dispatch({ type: 'started' });
      const result = await foregroundLocation.acquire({
        accuracy: 'high',
        onApproximate: (fix: LocationFix) => dispatch({ fix, type: 'approximate' }),
      });
      if (result.status === 'fix') await persist(result.fix.point, false);
      else if (result.status === 'approximate') {
        dispatch({ fix: result.fix, reason: result.reason, type: 'needs-confirmation' });
      } else dispatch({ reason: result.reason, type: 'failed' });
    });
  }, [flight, persist]);

  /** Explicit confirmation of an approximate position. */
  const confirmApproximate = useCallback(async () => {
    if (state.kind !== 'confirm-approximate') return;
    await flight.run(() => persist(state.fix.point, true));
  }, [flight, persist, state]);

  const dismiss = useCallback(() => dispatch({ type: 'dismissed' }), []);

  return {
    confirmApproximate,
    dismiss,
    isBusy: isLocateBusy(state),
    locate,
    state,
    status: locateStatus(state),
  };
}
