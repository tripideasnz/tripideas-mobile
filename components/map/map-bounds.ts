import MapView from 'react-native-maps';

import type { MapPlace } from '@/sanity/types';

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function getMapCoordinates(places: MapPlace[]): Coordinate[] {
  return places.flatMap((place) => {
    const latitude = place.coordinates?.lat;
    const longitude = place.coordinates?.lng;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return [];
    }

    return [{ latitude: latitude as number, longitude: longitude as number }];
  });
}

export function fitMapToPlaces(
  map: MapView | null,
  places: MapPlace[],
  options?: {
    bottomPadding?: number;
  }
) {
  const coordinates = getMapCoordinates(places);

  if (!map || coordinates.length === 0) {
    return false;
  }

  if (coordinates.length === 1) {
    map.animateToRegion(
      {
        ...coordinates[0],
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      450
    );
    return true;
  }

  map.fitToCoordinates(coordinates, {
    animated: true,
    edgePadding: {
      bottom: options?.bottomPadding ?? 220,
      left: 48,
      right: 48,
      top: 120,
    },
  });
  return true;
}
