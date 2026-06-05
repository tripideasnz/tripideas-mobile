import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
      .fetch<IslandRegionsResponse | null>(ISLAND_REGIONS_QUERY, {
        slug: selectedSlug,
      })
      .then((data) => {
        if (isMounted) {
          setIsland(data?.island ?? null);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setIsland(null);
          setErrorMessage('Unable to load island regions.');
        }
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

  const regions = (island?.regions ?? []).filter(Boolean);
  const title = island?.title ? `${island.title} Regions` : 'Island Regions';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ title }} />

      <View style={{ padding: 24 }}>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : errorMessage ? (
          <Text>{errorMessage}</Text>
        ) : !island ? (
          <Text>Island regions not found.</Text>
        ) : (
          <>
            <Text style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
              {title}
            </Text>

            <Text style={{ color: '#4a4a4a', fontSize: 16, marginBottom: 20 }}>
              Browse regions for {island.title ?? 'this island'}.
            </Text>

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
                    style={{
                      borderBottomColor: '#ddd',
                      borderBottomWidth: 1,
                      paddingVertical: 14,
                    }}>
                    <Text style={{ fontSize: 18, fontWeight: '600' }}>
                      {region.name ?? 'Untitled region'}
                    </Text>

                    {region.maori ? (
                      <Text style={{ color: '#717171', fontSize: 14, marginTop: 4 }}>
                        {region.maori}
                      </Text>
                    ) : null}
                  </Pressable>
                </Link>
              ))
            ) : (
              <Text>No regions found.</Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
