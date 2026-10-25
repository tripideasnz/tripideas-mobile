// Pure map filtering and list-stability helpers, moved out of the Map screen so
// they can be tested. Behaviour is unchanged.
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import type { MapContentSelection } from '@/components/map/map-selection';
import type { MapPlace } from '@/sanity/types';

export type MappablePlace = MapPlace & {
  coordinates: {
    lat: number;
    lng: number;
  };
};

export function hasValidCoordinates(place: MapPlace): place is MappablePlace {
  return (
    Number.isFinite(place.coordinates?.lat) &&
    Number.isFinite(place.coordinates?.lng)
  );
}

export const mapPlaceId = (place: MapPlace) => place._id ?? place.slug?.current ?? `${place.coordinates?.lat}-${place.coordinates?.lng}`;

export function matchesSearch(place: MapPlace, query: string) {
  if (!query) {
    return true;
  }

  return [
    place.title,
    place.subtitle,
    place.subRegion?.name,
    place.subRegion?.region?.name,
  ]
    .filter(Boolean)
    .some((value) => value?.toLocaleLowerCase().includes(query));
}

export function matchesActivityTags(place: MapPlace, selectedTagIds: string[]) {
  if (selectedTagIds.length === 0) {
    return true;
  }

  const selectedIds = new Set(selectedTagIds);
  return (place.activityTags ?? []).some(
    (tag) => Boolean(tag._id && selectedIds.has(tag._id))
  );
}

export function getPlacesForSelection({
  places,
  savedPlaceIds,
  selection,
  trips,
}: {
  places: MappablePlace[];
  savedPlaceIds: string[];
  selection: MapContentSelection;
  trips: { id: string; places?: { placeId: string }[] }[];
}) {
  if (selection.type === 'region') {
    return places.filter(
      (place) => place.subRegion?.region?._id === selection.regionId
    );
  }

  if (selection.type === 'subregion') {
    return places.filter(
      (place) => place.subRegion?._id === selection.subRegionId
    );
  }

  if (selection.type === 'favourites') {
    const savedIds = new Set(savedPlaceIds);
    return places.filter((place) => Boolean(place._id && savedIds.has(place._id)));
  }

  if (selection.type === 'trip') {
    const trip = trips.find((candidate) => candidate.id === selection.tripId);
    const tripPlaceIds = new Set(
      (trip?.places ?? []).map((place) => place.placeId)
    );
    return places.filter((place) =>
      Boolean(place._id && tripPlaceIds.has(place._id))
    );
  }

  return places;
}

/** The subset of already-filtered places inside the visible bounds, in order. */
export function placesInBounds(
  places: MappablePlace[],
  bounds: LngLatBounds | null
): MappablePlace[] {
  if (!bounds) return places;
  const [west, south, east, north] = bounds;
  return places.filter(
    (place) =>
      place.coordinates.lng >= west &&
      place.coordinates.lng <= east &&
      place.coordinates.lat >= south &&
      place.coordinates.lat <= north
  );
}

/**
 * Returns `previous` when `next` holds exactly the same items in the same
 * order. Viewport changes that do not change the visible places then keep the
 * same array, so the list is not handed new data.
 */
export function reuseIfSame<T>(previous: readonly T[], next: T[]): T[] {
  if (previous.length !== next.length) return next;
  for (let index = 0; index < next.length; index += 1) {
    if (previous[index] !== next[index]) return next;
  }
  return previous as T[];
}
