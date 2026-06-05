import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceCard } from '@/components/place-card';
import { useSavedPlaces } from '@/saved/provider';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import type { PlaceCardData } from '@/types/content';

export default function SavedScreen() {
  const { isLoading: isLoadingSavedIds, savedPlaceIds } = useSavedPlaces();
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoadingSavedIds) {
      return;
    }

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
        if (isMounted) {
          setPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setPlaces([]);
          setErrorMessage('Unable to load saved places.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPlaces(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isLoadingSavedIds, savedPlaceIds]);

  const isLoading = isLoadingSavedIds || isLoadingPlaces;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 32,
          paddingHorizontal: 24,
          paddingTop: 20,
        }}>
        <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 18 }}>
          Saved
        </Text>

        {isLoading ? (
          <Text style={{ color: '#717171', fontSize: 16 }}>
            Loading saved places...
          </Text>
        ) : errorMessage ? (
          <Text style={{ color: '#717171', fontSize: 16 }}>{errorMessage}</Text>
        ) : places.length > 0 ? (
          places.map((place, index) => (
            <PlaceCard
              key={place._id ?? place.slug?.current ?? index}
              place={place}
            />
          ))
        ) : (
          <Text style={{ color: '#717171', fontSize: 16 }}>
            No saved places yet.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
