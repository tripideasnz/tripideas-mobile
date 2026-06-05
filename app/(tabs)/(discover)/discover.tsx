import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sanityClient } from '@/sanity/client';
import { ISLANDS_QUERY } from '@/sanity/queries';
import type { IslandsResponse, IslandSummary } from '@/sanity/types';

export default function DiscoverScreen() {
  const [islands, setIslands] = useState<IslandSummary[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    sanityClient
      .fetch<IslandsResponse | null>(ISLANDS_QUERY)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setIslands(
          [
            data?.north ? { ...data.north, slug: 'north' as const } : null,
            data?.south ? { ...data.south, slug: 'south' as const } : null,
          ].filter(Boolean) as IslandSummary[],
        );
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setIslands([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 32,
          paddingHorizontal: 20,
          paddingTop: 20,
        }}>
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 8 }}>
            TripIdeas
          </Text>

          <Text style={{ color: '#4a4a4a', fontSize: 18, lineHeight: 25 }}>
            Explore New Zealand by island and region.
          </Text>
        </View>

        {!islands ? (
          <Text>Loading...</Text>
        ) : islands.length > 0 ? (
          islands.map((island) => <IslandCard key={island.slug} island={island} />)
        ) : (
          <Text>Islands not found.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function IslandCard({ island }: { island: IslandSummary }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        elevation: 2,
        marginBottom: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      }}>
      {island.imageUrl ? (
        <Image
          source={{ uri: island.imageUrl }}
          accessibilityLabel={island.imageAlt ?? island.title ?? 'Island image'}
          style={{ aspectRatio: 16 / 9, width: '100%' }}
          contentFit="cover"
        />
      ) : null}

      <View style={{ padding: 18 }}>
        <Text style={{ fontSize: 24, fontWeight: '700' }}>
          {island.title ?? 'Untitled island'}
        </Text>

        {island.maori ? (
          <Text
            style={{
              color: '#717171',
              fontSize: 15,
              fontWeight: '600',
              marginTop: 6,
            }}>
            {island.maori}
          </Text>
        ) : null}

        {island.preview ? (
          <Text
            numberOfLines={3}
            style={{
              color: '#4a4a4a',
              fontSize: 15,
              lineHeight: 21,
              marginTop: 12,
            }}>
            {island.preview}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Link
            href={{
              pathname: '/island/[slug]',
              params: { slug: island.slug },
            }}
            asChild>
            <Pressable
              style={{
                borderColor: '#111',
                borderRadius: 8,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}>
              <Text style={{ fontSize: 15, fontWeight: '700' }}>Read</Text>
            </Pressable>
          </Link>

          <Link
            href={{
              pathname: '/island/[slug]/regions',
              params: { slug: island.slug },
            }}
            asChild>
            <Pressable
              style={{
                backgroundColor: '#111',
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                Browse regions
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
