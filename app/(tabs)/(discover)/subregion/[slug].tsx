import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceCard } from '@/components/place-card';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space } from '@/constants/design';
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
        if (!isMounted) return;
        setSubRegion(data);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error(error);
        setSubRegion(null);
        setErrorMessage('Unable to load this subregion.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
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
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: Palette.background, flex: 1 }}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        {isLoading ? (
          <LoadingView />
        ) : errorMessage ? (
          <StatusText>{errorMessage}</StatusText>
        ) : !subRegion ? (
          <StatusText>Subregion not found.</StatusText>
        ) : (
          <>
            <AppText style={{ marginBottom: Space.xl }} variant="display">
              {subRegion.name}
            </AppText>

            <AppText style={{ marginBottom: Space.md }} variant="section">
              Places
            </AppText>

            {visiblePlaces.length > 0 ? (
              visiblePlaces.map((place, index) => (
                <PlaceCard
                  key={place._id ?? place.slug?.current ?? index}
                  place={place}
                />
              ))
            ) : (
              <StatusText>No places found.</StatusText>
            )}

            {hasMorePlaces ? (
              <AppButton
                label="Load more"
                onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
                style={{ marginTop: Space.lg }}
                variant="secondary"
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
