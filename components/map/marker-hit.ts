// Which pin a tap meant. The map reports every pin inside the finger-sized hit area, in
// no useful order, so with neighbouring pins the first one is often the wrong one (and a
// tap meant for the selected pin would select its neighbour instead of opening it).
// The pin nearest the touch wins.

type PointFeature = { geometry: { type: string } };

/** The Point feature closest to the touch (longitude, latitude), or undefined if there is none. */
export function nearestPointFeature<F extends PointFeature>(
  features: readonly F[],
  touch: readonly [number, number]
): F | undefined {
  // Longitude degrees shrink with latitude; without this, east-west distance is overstated.
  const lngScale = Math.cos((touch[1] * Math.PI) / 180);
  let best: F | undefined;
  let bestDistance = Infinity;
  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const [lng, lat] = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates;
    const distance = ((lng - touch[0]) * lngScale) ** 2 + (lat - touch[1]) ** 2;
    if (distance < bestDistance) {
      best = feature;
      bestDistance = distance;
    }
  }
  return best;
}
