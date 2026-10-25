// One-shot foreground location acquisition (no expo-location import, so the
// logic can be tested; foreground.ts supplies the real module).
//
// Privacy: foreground permission only, no background location, no watching, and
// nothing is persisted. Every call is a single explicit request by the user.
import type * as ExpoLocation from 'expo-location';

import type { ForegroundPoint } from '@/location/foreground-types';

export type LocationModule = Pick<
  typeof ExpoLocation,
  | 'Accuracy'
  | 'getCurrentPositionAsync'
  | 'getForegroundPermissionsAsync'
  | 'getLastKnownPositionAsync'
  | 'hasServicesEnabledAsync'
  | 'requestForegroundPermissionsAsync'
>;

/** A position and how trustworthy it is. */
export type LocationFix = {
  /** Age of a cached position; 0 for a fresh fix. */
  ageMs: number;
  /** True for a cached (last-known) position that has not been refreshed. */
  approximate: boolean;
  point: ForegroundPoint;
};

export type LocationFailureReason = 'denied' | 'services-disabled' | 'timeout' | 'unavailable';

export type LocationAcquisition =
  | { fix: LocationFix; status: 'fix' }
  | { fix: LocationFix; reason: 'timeout' | 'unavailable'; status: 'approximate' }
  | { reason: LocationFailureReason; status: 'failed' };

export type AcquireOptions = {
  accuracy?: 'balanced' | 'high';
  /** Called as soon as a recent cached position is available. */
  onApproximate?: (fix: LocationFix) => void;
  timeoutMs?: number;
};

export const DEFAULT_LOCATION_TIMEOUT_MS = 10_000;
export const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;
export const LAST_KNOWN_MAX_RADIUS_METERS = 1_000;

const toPoint = (coords: { accuracy: number | null; latitude: number; longitude: number }): ForegroundPoint => ({
  accuracyMeters: Number.isFinite(coords.accuracy) ? (coords.accuracy as number) : null,
  latitude: coords.latitude,
  longitude: coords.longitude,
});

export function createForegroundLocationService({
  location,
  now = Date.now,
}: {
  location: LocationModule;
  now?: () => number;
}) {
  // A granted permission is remembered for the session so repeat taps skip the
  // check. A denial we have already prompted for is never prompted again.
  let permissionGranted = false;
  let promptedAndDenied = false;
  let inFlight: Promise<LocationAcquisition> | null = null;
  const listeners = new Set<(fix: LocationFix) => void>();
  let lastApproximate: LocationFix | null = null;

  const ensurePermission = async (): Promise<LocationFailureReason | null> => {
    if (permissionGranted) return null;
    let permission = await location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (promptedAndDenied || permission.canAskAgain === false) return 'denied';
      permission = await location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        promptedAndDenied = true;
        return 'denied';
      }
    }
    permissionGranted = true;
    return null;
  };

  const acquire = async ({
    accuracy = 'balanced',
    timeoutMs = DEFAULT_LOCATION_TIMEOUT_MS,
  }: AcquireOptions): Promise<LocationAcquisition> => {
    try {
      const denied = await ensurePermission();
      if (denied) return { reason: denied, status: 'failed' };
      if (!(await location.hasServicesEnabledAsync())) {
        return { reason: 'services-disabled', status: 'failed' };
      }

      // Immediate, approximate feedback from a recent cached position.
      let approximate: LocationFix | null = null;
      try {
        const cached = await location.getLastKnownPositionAsync({
          maxAge: LAST_KNOWN_MAX_AGE_MS,
          requiredAccuracy: LAST_KNOWN_MAX_RADIUS_METERS,
        });
        if (cached) {
          approximate = {
            ageMs: Math.max(0, now() - cached.timestamp),
            approximate: true,
            point: toPoint(cached.coords),
          };
          lastApproximate = approximate;
          for (const listener of listeners) listener(approximate);
        }
      } catch {
        // A missing cached position is normal; carry on to a fresh fix.
      }

      // A fresh fix, but never wait indefinitely for it.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      });
      try {
        const fresh = await Promise.race([
          location.getCurrentPositionAsync({
            accuracy: accuracy === 'high' ? location.Accuracy.High : location.Accuracy.Balanced,
          }),
          timedOut,
        ]);
        if (fresh === 'timeout') {
          return approximate
            ? { fix: approximate, reason: 'timeout', status: 'approximate' }
            : { reason: 'timeout', status: 'failed' };
        }
        return { fix: { ageMs: 0, approximate: false, point: toPoint(fresh.coords) }, status: 'fix' };
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch {
      // Permission may have been revoked in Settings since it was granted.
      try {
        const permission = await location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          permissionGranted = false;
          return { reason: 'denied', status: 'failed' };
        }
      } catch {
        // fall through to unavailable
      }
      return lastApproximate
        ? { fix: lastApproximate, reason: 'unavailable', status: 'approximate' }
        : { reason: 'unavailable', status: 'failed' };
    }
  };

  return {
    /**
     * Single-flight: a call made while another is running joins it (and also
     * receives the approximate position), so overlapping requests never occur.
     */
    acquire(options: AcquireOptions = {}): Promise<LocationAcquisition> {
      if (options.onApproximate) listeners.add(options.onApproximate);
      if (!inFlight) {
        lastApproximate = null;
        inFlight = acquire(options).finally(() => {
          inFlight = null;
          listeners.clear();
        });
      } else if (options.onApproximate && lastApproximate) {
        options.onApproximate(lastApproximate);
      }
      return inFlight;
    },
  };
}

/** User-facing wording for a failed or approximate-only acquisition. */
export function describeLocationFailure(reason: LocationFailureReason): string {
  switch (reason) {
    case 'denied':
      return 'Location permission is off. Allow it in Settings, or choose the location on the map.';
    case 'services-disabled':
      return 'Location Services are turned off. Turn them on in Settings, or choose the location on the map.';
    case 'timeout':
      return 'Could not find your location in time. Try again, or choose it on the map.';
    default:
      return 'Your location is unavailable right now. Try again, or choose it on the map.';
  }
}

/** Whether Settings can fix the problem. */
export const failureNeedsSettings = (reason: LocationFailureReason) =>
  reason === 'denied' || reason === 'services-disabled';
