// Camera state that survives swapping the map for the full Place list.
import type {
  InitialViewState,
  LngLat,
  LngLatBounds,
  ViewPadding,
} from '@maplibre/maplibre-react-native';

export type MapCameraState = {
  bearing: number;
  center: LngLat;
  pitch: number;
  zoom: number;
};

/** Copies the camera fields out of a MapLibre region-change event. */
export const cameraStateFromRegion = (region: {
  bearing?: number;
  center: LngLat;
  pitch?: number;
  zoom: number;
}): MapCameraState => ({
  bearing: region.bearing ?? 0,
  center: region.center,
  pitch: region.pitch ?? 0,
  zoom: region.zoom,
});

/**
 * Where a (re)mounted map should start:
 *  - focused Place context wins;
 *  - once the map has been positioned (initially or by the user), restore that
 *    exact camera (centre, zoom, bearing, pitch) instead of refitting;
 *  - before that, the New Zealand overview.
 */
export function resolveInitialCamera({
  hasPositioned,
  last,
  nzBounds,
  nzPadding,
  placeContext,
}: {
  hasPositioned: boolean;
  last: MapCameraState;
  nzBounds: LngLatBounds;
  nzPadding: ViewPadding;
  placeContext: { lat: number; lng: number } | null;
}): InitialViewState {
  if (placeContext) {
    return { center: [placeContext.lng, placeContext.lat] as LngLat, zoom: 13 };
  }
  if (hasPositioned) {
    return {
      bearing: last.bearing,
      center: last.center,
      pitch: last.pitch,
      zoom: last.zoom,
    };
  }
  return { bounds: nzBounds, padding: nzPadding };
}
