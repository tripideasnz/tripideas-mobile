// When the saved-location thumbnail should move its camera.

/**
 * The map is created already centred on the coordinates it was mounted with.
 * It only needs to animate when it is ready and the coordinates have changed
 * since the camera was last positioned; this avoids both early (dropped)
 * commands and repeated animations.
 */
export const needsRecentre = (
  ready: boolean,
  applied: { latitude: number; longitude: number },
  next: { latitude: number; longitude: number }
): boolean =>
  ready && (applied.latitude !== next.latitude || applied.longitude !== next.longitude);
