import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space } from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { ISLAND_REGIONS_QUERY } from '@/sanity/queries';
import type { IslandRegions, IslandRegionsResponse } from '@/sanity/types';

export default function IslandRegionsScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const [island, setIsland] = useState<IslandRegions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSlug) {
      setIsland(null);
      setErrorMessage('Missing island slug.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);

    sanityClient
      .fetch<IslandRegionsResponse | null>(ISLAND_REGIONS_QUERY, { slug: selectedSlug })
      .then((data) => {
        if (isMounted) setIsland(data?.island ?? null);
      })
      .catch((error) => {
        console.error(error);
        if (isMounted) {
          setIsland(null);
          setErrorMessage('Unable to load island regions.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);

  const regions = (island?.regions ?? []).filter(Boolean);
  const title = island?.title ? `${island.title} Regions` : 'Island Regions';

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
        ) : !island ? (
          <StatusText>Island regions not found.</StatusText>
        ) : (
          <>
            <AppText style={{ marginBottom: Space.xxl }} variant="display">
              {title}
            </AppText>

            {regions.length > 0 ? (
              regions.map((region, index) => (
                <Link
                  key={region._id ?? region.slug?.current ?? index}
                  href={{
                    pathname: '/region/[slug]',
                    params: { slug: region.slug?.current ?? '' },
                  }}
                  asChild>
                  <Pressable
                    disabled={!region.slug?.current}
                    style={({ pressed }) => ({
                      borderBottomColor: Palette.border,
                      borderBottomWidth: 1,
                      opacity: pressed ? 0.55 : 1,
                      paddingVertical: Space.lg,
                    })}>
                    <AppText>{region.name}</AppText>
                    {region.maori ? (
                      <AppText color={Palette.textMuted} variant="caption">
                        {region.maori}
                      </AppText>
                    ) : null}
                  </Pressable>
                </Link>
              ))
            ) : (
              <StatusText>No regions found.</StatusText>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
