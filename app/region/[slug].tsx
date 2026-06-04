import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

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
        if (!isMounted) {
          return;
        }

        setRegion(data);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error(error);
        setRegion(null);
        setErrorMessage('Unable to load this region.');
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

  const subRegions = (region?.subRegions ?? []).filter(Boolean);
  const title = region?.name ?? 'Region';

  return (
    <ScrollView style={{ flex: 1, padding: 24 }}>
      <Stack.Screen options={{ title }} />

      {isLoading ? (
        <Text>Loading...</Text>
      ) : errorMessage ? (
        <Text>{errorMessage}</Text>
      ) : !region ? (
        <Text>Region not found.</Text>
      ) : (
        <>
          <Text style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
            {region.name ?? 'Untitled region'}
          </Text>

          {region.maori ? (
            <Text style={{ fontSize: 18, marginBottom: 24 }}>
              {region.maori}
            </Text>
          ) : null}

          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
            Subregions
          </Text>

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
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#ddd',
                  }}>
                  <Text style={{ fontSize: 17 }}>
                    {subRegion.name ?? 'Untitled subregion'}
                  </Text>
                </Pressable>
              </Link>
            ))
          ) : (
            <Text>No subregions found.</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
