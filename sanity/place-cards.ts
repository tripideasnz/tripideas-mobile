import { sanityClient } from '@/sanity/client';
import { PLACE_CARDS_BY_IDS_QUERY } from '@/sanity/queries';
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
