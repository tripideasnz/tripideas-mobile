import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useCallback, useState, type RefObject } from 'react';
import { Alert } from 'react-native';

import { getOneForegroundLocation, type ForegroundPoint } from '@/location/foreground';

export function useMapUserLocation(camera: RefObject<CameraRef | null>, minimumZoom = 13) {
  const [userPosition, setUserPosition] = useState<ForegroundPoint | null>(null);
  const locateUser = useCallback(async () => {
    const result = await getOneForegroundLocation();
    if (result.status !== 'granted') {
      Alert.alert(
        'Location unavailable',
        result.status === 'denied'
          ? 'Foreground location permission was not granted.'
          : 'Your current location could not be obtained.'
      );
      return;
    }
    setUserPosition(result.point);
    camera.current?.easeTo({
      center: [result.point.longitude, result.point.latitude],
      duration: 400,
      zoom: minimumZoom,
    });
  }, [camera, minimumZoom]);
  return { locateUser, userPosition };
}
