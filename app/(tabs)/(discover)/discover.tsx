import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBrandHeader } from '@/components/app-brand-header';
import { CardSurface } from '@/components/ui/card-surface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MediaFrame } from '@/components/ui/media-frame';
import {
  Palette,
  Radius,
  Screen,
  Space,
  Type,
} from '@/constants/design';
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
  const [cardsAreaHeight, setCardsAreaHeight] = useState(0);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const horizontalContentWidth = windowWidth - Screen.gutter * 2;
  const fallbackCardsAreaHeight = Math.max(420, windowHeight - 230);
  const availableCardsHeight = cardsAreaHeight || fallbackCardsAreaHeight;
  const cardGap = Space.lg;
  const cardHeight = Math.min(
    330,
    Math.max(196, (availableCardsHeight - cardGap) / 2)
  );
  const titleAreaHeight = Math.min(92, Math.max(70, cardHeight * 0.28));
  const imageHeight = Math.max(126, cardHeight - titleAreaHeight);
  const expandedImageHeight = horizontalContentWidth / 2.05;
  const titleFontSize = Math.min(24, Math.max(20, cardHeight * 0.075));
  const titleLineHeight = Math.round(titleFontSize * 1.22);
  const maoriFontSize = Math.min(15, Math.max(13, cardHeight * 0.045));
  const maoriLineHeight = Math.round(maoriFontSize * 1.3);

  const handleCardsAreaLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;

    if (Math.abs(nextHeight - cardsAreaHeight) > 1) {
      setCardsAreaHeight(nextHeight);
    }
  };

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
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Space.lg,
        }}>
        <AppBrandHeader
          compact
          subtitle="Choose an island to explore Aotearoa."
        />

        {!islands ? (
          <Text>Loading...</Text>
        ) : islands.length > 0 ? (
          <View
            onLayout={handleCardsAreaLayout}
            style={{ flex: 1, justifyContent: 'center' }}>
            {islands.map((island) => (
              <IslandCard
                cardHeight={cardHeight}
                expandedImageHeight={expandedImageHeight}
                imageHeight={imageHeight}
                key={island.slug}
                island={island}
                maoriFontSize={maoriFontSize}
                maoriLineHeight={maoriLineHeight}
                titleFontSize={titleFontSize}
                titleLineHeight={titleLineHeight}
              />
            ))}
          </View>
        ) : (
          <Text>Islands not found.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function IslandCard({
  cardHeight,
  expandedImageHeight,
  imageHeight,
  island,
  maoriFontSize,
  maoriLineHeight,
  titleFontSize,
  titleLineHeight,
}: {
  cardHeight: number;
  expandedImageHeight: number;
  imageHeight: number;
  island: IslandSummary;
  maoriFontSize: number;
  maoriLineHeight: number;
  titleFontSize: number;
  titleLineHeight: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const regions = (island.regions ?? []).filter(Boolean);

  return (
    <CardSurface
      style={{
        height: isOpen ? undefined : cardHeight,
        marginBottom: Space.lg,
      }}>
      {island.imageUrl ? (
        <MediaFrame
          accessibilityLabel={island.imageAlt ?? island.title ?? 'Island image'}
          source={{ uri: island.imageUrl }}
          radius={0}
          style={{ height: isOpen ? expandedImageHeight : imageHeight }}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => ({
          alignItems: 'center',
          flexDirection: 'row',
          flex: isOpen ? undefined : 1,
          opacity: pressed ? 0.65 : 1,
          paddingHorizontal: Space.lg,
          paddingVertical: isOpen ? Space.md : Space.sm,
        })}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: titleFontSize,
              fontWeight: '700',
              lineHeight: titleLineHeight,
            }}>
            {island.title}
          </Text>
          {island.maori ? (
            <Text
              style={{
                color: Palette.textMuted,
                fontSize: maoriFontSize,
                fontWeight: '700',
                lineHeight: maoriLineHeight,
                marginTop: Space.xs,
              }}>
              {island.maori}
            </Text>
          ) : null}
        </View>
        <IconSymbol
          color={Palette.textBody}
          name="chevron.right"
          size={20}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {isOpen ? (
        <View style={{ borderTopColor: Palette.border, borderTopWidth: 1 }}>
          {regions.length > 0 ? (
            regions.map((region, index) => (
              <RegionSection
                key={region._id ?? region.slug?.current ?? index}
                region={region}
              />
            ))
          ) : (
            <Text style={{ color: Palette.textMuted, padding: Space.lg }}>
              No regions found.
            </Text>
          )}
        </View>
      ) : null}
    </CardSurface>
  );
}

function RegionSection({ region }: { region: Region }) {
  const [isOpen, setIsOpen] = useState(false);
  const subRegions = (region.subRegions ?? []).filter(Boolean);

  return (
    <View style={{ borderBottomColor: Palette.border, borderBottomWidth: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => ({
          alignItems: 'center',
          flexDirection: 'row',
          opacity: pressed ? 0.65 : 1,
          paddingHorizontal: Space.lg,
          paddingVertical: Space.md,
        })}>
        {region.imageUrl ? (
          <Image
            accessibilityLabel={region.imageAlt ?? region.name ?? 'Region image'}
            contentFit="cover"
            source={{ uri: region.imageUrl }}
            style={{
              borderRadius: Radius.small,
              height: 52,
              marginRight: Space.md,
              width: 52,
            }}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={Type.cardTitle}>
            {region.name}
          </Text>
          {region.maori ? (
            <Text
              style={{
                color: Palette.textMuted,
                ...Type.label,
                marginTop: Space.xs,
              }}>
              {region.maori}
            </Text>
          ) : null}
        </View>
        <IconSymbol
          color={Palette.textMuted}
          name="chevron.right"
          size={18}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {isOpen ? (
        <View
          style={{
            backgroundColor: Palette.surfaceMuted,
            paddingHorizontal: Space.lg,
          }}>
          {subRegions.length > 0 ? (
            subRegions.map((subRegion, index) => (
              <SubRegionLink
                key={subRegion._id ?? subRegion.slug?.current ?? index}
                subRegion={subRegion}
              />
            ))
          ) : (
            <Text style={{ color: Palette.textMuted, paddingVertical: 14 }}>
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
          borderBottomColor: Palette.border,
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
              borderRadius: Radius.small,
              height: 44,
              marginRight: Space.md,
              width: 44,
            }}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={Type.bodyStrong}>
            {subRegion.name}
          </Text>
          {subRegion.maori ? (
            <Text
              style={{
                color: Palette.textMuted,
                ...Type.caption,
                marginTop: Space.xs,
              }}>
              {subRegion.maori}
            </Text>
          ) : null}
        </View>
        {placeCount !== null ? (
          <Text
            style={{
              color: Palette.textMuted,
              ...Type.label,
              marginRight: Space.sm,
            }}>
            {placeCount}
          </Text>
        ) : null}
        <IconSymbol color={Palette.textMuted} name="chevron.right" size={16} />
      </Pressable>
    </Link>
  );
}
