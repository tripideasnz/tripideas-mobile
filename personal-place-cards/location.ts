export function parsePersonalPlaceCardCoordinates(
  latitude: string,
  longitude: string
) {
  if (!latitude.trim() || !longitude.trim()) return null;

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (
    !Number.isFinite(parsedLatitude) ||
    parsedLatitude < -90 ||
    parsedLatitude > 90 ||
    !Number.isFinite(parsedLongitude) ||
    parsedLongitude < -180 ||
    parsedLongitude > 180
  ) {
    return null;
  }

  return { latitude: parsedLatitude, longitude: parsedLongitude };
}
