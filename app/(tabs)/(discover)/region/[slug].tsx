import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space } from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { REGION_QUERY } from '@/sanity/queries';
import type { RegionDetail } from '@/sanity/types';

export default function RegionScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const [region, setRegion] = useState<RegionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSlug) {
      setRegion(null);
      setErrorMessage('Missing region slug.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);

    sanityClient
      .fetch<RegionDetail | null>(REGION_QUERY, { slug: selectedSlug })
      .then((data) => {
        if (!isMounted) return;
        setRegion(data);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error(error);
        setRegion(null);
        setErrorMessage('Unable to load this region.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);

  const subRegions = (region?.subRegions ?? []).filter(Boolean);
  const title = region?.name ?? 'Region';

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
        ) : !region ? (
          <StatusText>Region not found.</StatusText>
        ) : (
          <>
            <AppText style={{ marginBottom: Space.xs }} variant="display">
              {region.name}
            </AppText>

            {region.maori ? (
              <AppText
                color={Palette.textMuted}
                style={{ marginBottom: Space.xxl }}
                variant="cardTitle">
                {region.maori}
              </AppText>
            ) : null}

            <AppText style={{ marginBottom: Space.md }} variant="section">
              Subregions
            </AppText>

            {subRegions.length > 0 ? (
              subRegions.map((subRegion, index) => (
                <Link
                  key={subRegion._id ?? subRegion.slug?.current ?? index}
                  href={{
                    pathname: '/subregion/[slug]',
                    params: { slug: subRegion.slug?.current ?? '' },
                  }}
                  asChild>
                  <Pressable
                    disabled={!subRegion.slug?.current}
                    style={({ pressed }) => ({
                      borderBottomColor: Palette.border,
                      borderBottomWidth: 1,
                      opacity: pressed ? 0.55 : 1,
                      paddingVertical: Space.lg,
                    })}>
                    <AppText>{subRegion.name}</AppText>
                  </Pressable>
                </Link>
              ))
            ) : (
              <StatusText>No subregions found.</StatusText>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
