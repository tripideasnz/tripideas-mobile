import * as Location from 'expo-location';

import { createForegroundLocationService } from '@/location/foreground-acquire';
import type { ForegroundPoint } from '@/location/foreground-types';

export type { ForegroundPoint } from '@/location/foreground-types';
export {
  describeLocationFailure,
  failureNeedsSettings,
  type AcquireOptions,
  type LocationAcquisition,
  type LocationFailureReason,
  type LocationFix,
} from '@/location/foreground-acquire';

/** Shared one-shot acquisition: last-known first, timeout, single-flight. */
export const foregroundLocation = createForegroundLocationService({ location: Location });
export type ForegroundLocationResult =
  | { status: 'granted'; point: ForegroundPoint }
  | { status: 'denied' | 'unavailable' };

export async function getOneForegroundLocation(): Promise<ForegroundLocationResult> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { status: 'granted', point: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy : null,
    } };
  } catch {
    return { status: 'unavailable' };
  }
}
