// MapTiler streets-v2 — same provider and style as the TripIdeas web app.
// The key is shared with the web app (NEXT_PUBLIC_MAPTILER_API_KEY).
// Set EXPO_PUBLIC_MAP_STYLE_URL in .env.local.
export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ??
  'https://api.maptiler.com/maps/streets-v2/style.json?key=MISSING_KEY';

// Derive the MapTiler key from the primary URL so satellite shares the same key.
const _mapTilerKey =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL?.match(/key=([^&]+)/)?.[1] ?? 'MISSING_KEY';

export const MAP_SATELLITE_URL = `https://api.maptiler.com/maps/satellite/style.json?key=${_mapTilerKey}`;

export type MapStyleId = 'streets' | 'satellite';

export const MAP_STYLES: { id: MapStyleId; label: string; url: string }[] = [
  { id: 'streets', label: 'Map', url: MAP_STYLE_URL },
  { id: 'satellite', label: 'Satellite', url: MAP_SATELLITE_URL },
  // TODO: cycle tracks (MapTiler cycling style or custom overlay)
  // TODO: walking/tramping tracks (DOC track network)
  // TODO: paper roads and legal access (LINZ layer)
  // TODO: DOC / public conservation land overlay
];
