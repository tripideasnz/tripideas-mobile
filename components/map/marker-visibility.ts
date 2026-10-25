// Keeping a selected marker (and its label) clear of the controls and sheet
// that cover part of the map. Pure geometry; no native map calls.
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

export type ObscuredEdges = { bottom: number; left: number; right: number; top: number };

/** Web-Mercator y, so vertical position is correct at national zoom. */
const mercatorY = (latitude: number) => {
  const radians = (Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
};

/** Pixel position of a coordinate inside the visible bounds, or null if degenerate. */
export function markerPixelPosition(
  marker: { lat: number; lng: number },
  bounds: LngLatBounds,
  viewport: { height: number; width: number }
): { x: number; y: number } | null {
  const [west, south, east, north] = bounds;
  const width = east - west;
  const height = mercatorY(north) - mercatorY(south);
  if (!(width > 0) || !(height > 0)) return null;
  return {
    x: ((marker.lng - west) / width) * viewport.width,
    y: ((mercatorY(north) - mercatorY(marker.lat)) / height) * viewport.height,
  };
}

/**
 * True when the marker is outside the part of the map the user can actually
 * see (inside the margin, clear of the filter bar, the label above the marker
 * and the sheet below). A marker that is already clearly visible never moves.
 */
export function selectedMarkerNeedsMove({
  bounds,
  marker,
  margin = 16,
  obscured,
  viewport,
}: {
  bounds: LngLatBounds | null;
  marker: { lat: number; lng: number };
  margin?: number;
  obscured: ObscuredEdges;
  viewport: { height: number; width: number };
}): boolean {
  if (!bounds || viewport.width <= 0 || viewport.height <= 0) return false;
  const position = markerPixelPosition(marker, bounds, viewport);
  if (!position) return false;
  return (
    position.x < obscured.left + margin ||
    position.x > viewport.width - obscured.right - margin ||
    position.y < obscured.top + margin ||
    position.y > viewport.height - obscured.bottom - margin
  );
}

/**
 * Camera move that puts the marker in the middle of the unobscured area while
 * keeping the current zoom (no zoom option is given).
 */
export const revealMarkerCamera = (
  marker: { lat: number; lng: number },
  obscured: ObscuredEdges,
  durationMs = 350
) => ({
  center: [marker.lng, marker.lat] as [number, number],
  duration: durationMs,
  padding: obscured,
});
