import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { Alert, Linking } from 'react-native';

import {
  describeLocationFailure,
  failureNeedsSettings,
  foregroundLocation,
  type ForegroundPoint,
} from '@/location/foreground';
import { runMapLocate } from '@/location/map-locate';
import { createSingleFlight } from '@/location/single-flight';

/**
 * Shared "show my location" behaviour for every map: one request at a time,
 * a recent cached position first, then a refined fix. It only moves the camera
 * and the user marker, so active map filters are never touched.
 */
export function useMapUserLocation(
  camera: RefObject<CameraRef | null>,
  {
    getZoom,
    minimumZoom = 13,
    onBeforeMove,
  }: {
    /** The map's current zoom, so recentring never zooms out. */
    getZoom?: () => number;
    minimumZoom?: number;
    /** Runs before the camera moves (for example to cancel a pending fit). */
    onBeforeMove?: () => void;
  } = {}
) {
  const [userPosition, setUserPosition] = useState<ForegroundPoint | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const flight = useMemo(() => createSingleFlight(), []);

  const locateUser = useCallback(async () => {
    const outcome = await flight.run(async () => {
      setIsLocating(true);
      try {
        await runMapLocate({
          acquire: (options) => foregroundLocation.acquire(options),
          moveCamera: (point, duration) => {
            onBeforeMove?.();
            camera.current?.easeTo({
              center: [point.longitude, point.latitude],
              duration,
              zoom: Math.max(getZoom?.() ?? minimumZoom, minimumZoom),
            });
          },
          notifyFailure: (reason) =>
            Alert.alert(
              'Location unavailable',
              describeLocationFailure(reason),
              failureNeedsSettings(reason)
                ? [{ style: 'cancel', text: 'Not now' }, { onPress: () => void Linking.openSettings(), text: 'Open Settings' }]
                : undefined
            ),
          setPosition: setUserPosition,
        });
      } finally {
        setIsLocating(false);
      }
    });
    return outcome.skipped ? 'busy' : 'done';
  }, [camera, flight, getZoom, minimumZoom, onBeforeMove]);

  return { isLocating, locateUser, userPosition };
}
