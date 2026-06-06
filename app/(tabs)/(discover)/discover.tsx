import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { sanityClient } from '@/sanity/client';
import { ISLANDS_QUERY } from '@/sanity/queries';
import type {
  IslandsResponse,
  IslandSummary,
  Region,
  SubRegionSummary,
} from '@/sanity/types';

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
            Explore New Zealand by island, region, and sub-region.
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
  const [isOpen, setIsOpen] = useState(false);
  const regions = (island.regions ?? []).filter(Boolean);

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        borderColor: '#e2e2e2',
        borderWidth: 1,
        elevation: 2,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      }}>
      {island.imageUrl ? (
        <Image
          accessibilityLabel={island.imageAlt ?? island.title ?? 'Island image'}
          contentFit="cover"
          source={{ uri: island.imageUrl }}
          style={{ aspectRatio: 16 / 9, width: '100%' }}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => ({
          alignItems: 'center',
          flexDirection: 'row',
          opacity: pressed ? 0.65 : 1,
          padding: 18,
        })}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '700' }}>
            {island.title ?? 'Untitled island'}
          </Text>
          {island.maori ? (
            <Text
              style={{
                color: '#717171',
                fontSize: 15,
                fontWeight: '600',
                marginTop: 4,
              }}>
              {island.maori}
            </Text>
          ) : null}
        </View>
        <IconSymbol
          color="#4a4a4a"
          name="chevron.right"
          size={20}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {isOpen ? (
        <View style={{ borderTopColor: '#e2e2e2', borderTopWidth: 1 }}>
          {regions.length > 0 ? (
            regions.map((region, index) => (
              <RegionSection
                key={region._id ?? region.slug?.current ?? index}
                region={region}
              />
            ))
          ) : (
            <Text style={{ color: '#717171', padding: 18 }}>
              No regions found.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function RegionSection({ region }: { region: Region }) {
  const [isOpen, setIsOpen] = useState(false);
  const subRegions = (region.subRegions ?? []).filter(Boolean);

  return (
    <View style={{ borderBottomColor: '#ededed', borderBottomWidth: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => ({
          alignItems: 'center',
          flexDirection: 'row',
          opacity: pressed ? 0.65 : 1,
          paddingHorizontal: 18,
          paddingVertical: 15,
        })}>
        {region.imageUrl ? (
          <Image
            accessibilityLabel={region.imageAlt ?? region.name ?? 'Region image'}
            contentFit="cover"
            source={{ uri: region.imageUrl }}
            style={{
              borderRadius: 8,
              height: 52,
              marginRight: 12,
              width: 52,
            }}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>
            {region.name ?? 'Untitled region'}
          </Text>
          {region.maori ? (
            <Text style={{ color: '#717171', fontSize: 14, marginTop: 3 }}>
              {region.maori}
            </Text>
          ) : null}
        </View>
        <IconSymbol
          color="#717171"
          name="chevron.right"
          size={18}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {isOpen ? (
        <View
          style={{
            backgroundColor: '#f8f8f8',
            paddingHorizontal: 18,
          }}>
          {subRegions.length > 0 ? (
            subRegions.map((subRegion, index) => (
              <SubRegionLink
                key={subRegion._id ?? subRegion.slug?.current ?? index}
                subRegion={subRegion}
              />
            ))
          ) : (
            <Text style={{ color: '#717171', paddingVertical: 14 }}>
              No sub-regions found.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function SubRegionLink({ subRegion }: { subRegion: SubRegionSummary }) {
  const placeCount =
    typeof subRegion.placeCount === 'number' ? subRegion.placeCount : null;

  return (
    <Link
      href={{
        pathname: '/subregion/[slug]',
        params: { slug: subRegion.slug?.current ?? '' },
      }}
      asChild>
      <Pressable
        disabled={!subRegion.slug?.current}
        style={({ pressed }) => ({
          alignItems: 'center',
          borderBottomColor: '#e2e2e2',
          borderBottomWidth: 1,
          flexDirection: 'row',
          opacity: pressed ? 0.6 : 1,
          paddingVertical: 14,
        })}>
        {subRegion.imageUrl ? (
          <Image
            accessibilityLabel={
              subRegion.imageAlt ?? subRegion.name ?? 'Sub-region image'
            }
            contentFit="cover"
            source={{ uri: subRegion.imageUrl }}
            style={{
              borderRadius: 7,
              height: 44,
              marginRight: 12,
              width: 44,
            }}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>
            {subRegion.name ?? 'Untitled sub-region'}
          </Text>
          {subRegion.maori ? (
            <Text style={{ color: '#717171', fontSize: 13, marginTop: 3 }}>
              {subRegion.maori}
            </Text>
          ) : null}
        </View>
        {placeCount !== null ? (
          <Text style={{ color: '#717171', fontSize: 14, marginRight: 8 }}>
            {placeCount}
          </Text>
        ) : null}
        <IconSymbol color="#717171" name="chevron.right" size={16} />
      </Pressable>
    </Link>
  );
}
