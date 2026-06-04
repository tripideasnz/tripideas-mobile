import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { sanityClient } from '@/sanity/client';
import { SUBREGION_QUERY } from '@/sanity/queries';
import type { SubRegionDetail } from '@/sanity/types';

const PAGE_SIZE = 10;

export default function SubRegionScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const [subRegion, setSubRegion] = useState<SubRegionDetail | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSlug) {
      setSubRegion(null);
      setErrorMessage('Missing subregion slug.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);
    setVisibleCount(PAGE_SIZE);

    sanityClient
      .fetch<SubRegionDetail | null>(SUBREGION_QUERY, { slug: selectedSlug })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setSubRegion(data);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error(error);
        setSubRegion(null);
        setErrorMessage('Unable to load this subregion.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);

  const places = (subRegion?.places ?? []).filter(Boolean);
  const visiblePlaces = places.slice(0, visibleCount);
  const hasMorePlaces = visibleCount < places.length;
  const title = subRegion?.name ?? 'Subregion';

  return (
    <ScrollView style={{ flex: 1, padding: 24, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ title }} />

      {isLoading ? (
        <Text>Loading...</Text>
      ) : errorMessage ? (
        <Text>{errorMessage}</Text>
      ) : !subRegion ? (
        <Text>Subregion not found.</Text>
      ) : (
        <>
          <Text style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
            {subRegion.name ?? 'Untitled subregion'}
          </Text>

          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
            Places
          </Text>

          {visiblePlaces.length > 0 ? (
            visiblePlaces.map((place, index) => (
              <PlaceCard
                key={place._id ?? place.slug?.current ?? index}
                place={place}
              />
            ))
          ) : (
            <Text>No places found.</Text>
          )}

          {hasMorePlaces ? (
            <Pressable
              onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
              style={{
                alignItems: 'center',
                borderColor: '#111',
                borderRadius: 8,
                borderWidth: 1,
                marginTop: 16,
                paddingVertical: 12,
              }}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>
                Load more
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
