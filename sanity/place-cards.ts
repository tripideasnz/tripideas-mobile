import { sanityClient } from '@/sanity/client';
import {
  MAP_ACTIVITIES_QUERY,
  MAP_NAVIGATION_QUERY,
  MAP_PLACES_BY_IDS_QUERY,
  MAP_PLACES_QUERY,
  PLACE_CARDS_BY_IDS_QUERY,
} from '@/sanity/queries';
import type {
  MapActivitySuperTag,
  MapNavigationResponse,
  MapPlace,
} from '@/sanity/types';
import type { PlaceCardData } from '@/types/content';

export async function fetchPlaceCardsByIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return [];
  }

  const places = await sanityClient.fetch<PlaceCardData[]>(
    PLACE_CARDS_BY_IDS_QUERY,
    { ids: uniqueIds }
  );
  const placesById = new Map(
    (places ?? [])
      .filter((place) => place?._id)
      .map((place) => [place._id, place])
  );

  return uniqueIds.flatMap((id) => {
    const place = placesById.get(id);
    return place ? [place] : [];
  });
}

export async function fetchMapPlaces() {
  const places = await sanityClient.fetch<MapPlace[]>(MAP_PLACES_QUERY);

  return (places ?? []).filter(Boolean);
}

export async function fetchMapPlacesByIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return [];
  }

  const places = await sanityClient.fetch<MapPlace[]>(
    MAP_PLACES_BY_IDS_QUERY,
    { ids: uniqueIds }
  );

  return (places ?? []).filter(Boolean);
}

export async function fetchMapNavigation() {
  const navigation =
    await sanityClient.fetch<MapNavigationResponse | null>(MAP_NAVIGATION_QUERY);

  return navigation ?? {};
}

export async function fetchMapActivities() {
  const activities =
    await sanityClient.fetch<MapActivitySuperTag[]>(MAP_ACTIVITIES_QUERY);

  return (activities ?? []).filter(Boolean);
}
