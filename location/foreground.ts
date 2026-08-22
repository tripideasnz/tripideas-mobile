import * as Location from 'expo-location';

export type ForegroundPoint = { latitude: number; longitude: number; accuracyMeters: number | null };
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
