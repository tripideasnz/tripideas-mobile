// MapTiler streets-v2 — same provider and style as the TripIdeas web app.
// The key is shared with the web app (NEXT_PUBLIC_MAPTILER_API_KEY).
// Set EXPO_PUBLIC_MAP_STYLE_URL in .env.local.
export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ??
  'https://api.maptiler.com/maps/streets-v2/style.json?key=MISSING_KEY';
