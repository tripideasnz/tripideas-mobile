import type { CameraRef, LngLat, LngLatBounds, ViewPadding } from '@maplibre/maplibre-react-native';

import type { MapPlace } from '@/sanity/types';

export function getMapLngLats(places: MapPlace[]): LngLat[] {
  return places.flatMap((place) => {
    const lng = place.coordinates?.lng;
    const lat = place.coordinates?.lat;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [[lng as number, lat as number] as LngLat];
  });
}

export function fitCameraToPlaces(
  camera: CameraRef | null,
  places: MapPlace[],
  padding?: ViewPadding
): boolean {
  const coords = getMapLngLats(places);

  if (!camera || coords.length === 0) return false;

  const resolved: ViewPadding = {
    top: padding?.top ?? 120,
    right: padding?.right ?? 56,
    bottom: padding?.bottom ?? 280,
    left: padding?.left ?? 56,
  };

  if (coords.length === 1) {
    camera.easeTo({ center: coords[0], zoom: 13, duration: 450, padding: resolved });
    return true;
  }

  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const bounds: LngLatBounds = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];

  camera.fitBounds(bounds, { padding: resolved, duration: 450 });
  return true;
}
