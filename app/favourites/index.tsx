import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space } from '@/constants/design';
import { useSavedPlaces } from '@/saved/provider';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import type { PlaceCardData } from '@/types/content';

export default function FavouritesScreen() {
  const { isLoading: isLoadingSavedIds, savedPlaceIds } = useSavedPlaces();
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoadingSavedIds) return;
    if (savedPlaceIds.length === 0) {
      setPlaces([]);
      setErrorMessage(null);
      setIsLoadingPlaces(false);
      return;
    }

    let isMounted = true;
    setIsLoadingPlaces(true);
    setErrorMessage(null);
    fetchPlaceCardsByIds(savedPlaceIds)
      .then((data) => {
        if (isMounted) setPlaces(data);
      })
      .catch((error) => {
        console.error(error);
        if (isMounted) {
          setPlaces([]);
          setErrorMessage('Unable to load favourites.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingPlaces(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isLoadingSavedIds, savedPlaceIds]);

  const isLoading = isLoadingSavedIds || isLoadingPlaces;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        gap: Space.md,
        paddingBottom: Screen.bottom,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}>
      {isLoading ? (
        <StatusText>Loading favourites...</StatusText>
      ) : errorMessage ? (
        <StatusText>{errorMessage}</StatusText>
      ) : places.length ? (
        places.map((place, index) => (
          <PlaceCard key={place._id ?? place.slug?.current ?? index} place={place} />
        ))
      ) : (
        <StatusText>No favourites yet.</StatusText>
      )}
    </ScrollView>
  );
}
