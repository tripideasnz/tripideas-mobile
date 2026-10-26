// One sub-region row in an expanded Discover region: thumbnail, name (with the Māori name
// beneath), then the Place count and a chevron together on the right.
//
// This is a plain Pressable that navigates with the router. It used to be
// `<Link asChild><Pressable style={fn}>`, but Expo Router's Link (Radix Slot) merges the child's
// style as `{ ...style }`, and spreading a *function* style gives `{}`: the row lost its
// `flexDirection: 'row'`, padding, divider and pressed opacity, so everything stacked
// vertically. `router.navigate` is exactly the action Link performs by default.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Radius, Space, Type } from '@/constants/design';
import type { SubRegionSummary } from '@/sanity/types';

/** Rows are never shorter than a comfortable touch target. */
export const SUBREGION_ROW_MIN_HEIGHT = 52;
/** The count column is a fixed width, so counts right-align and the chevrons line up. */
export const SUBREGION_COUNT_MIN_WIDTH = 28;

export function SubRegionLink({ subRegion }: { subRegion: SubRegionSummary }) {
  const router = useRouter();
  const slug = subRegion.slug?.current;
  const placeCount = typeof subRegion.placeCount === 'number' ? subRegion.placeCount : null;

  return (
    <Pressable
      accessibilityRole="link"
      disabled={!slug}
      onPress={() => router.navigate({ pathname: '/subregion/[slug]', params: { slug: slug ?? '' } })}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderBottomColor: Palette.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        minHeight: SUBREGION_ROW_MIN_HEIGHT,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: 14,
      })}>
      {subRegion.imageUrl ? (
        <Image
          accessibilityLabel={subRegion.imageAlt ?? subRegion.name ?? 'Sub-region image'}
          contentFit="cover"
          source={{ uri: subRegion.imageUrl }}
          style={{
            borderRadius: Radius.small,
            flexShrink: 0,
            height: 44,
            marginRight: Space.md,
            width: 44,
          }}
        />
      ) : null}

      {/* Left: the name, wrapping naturally if long, with the Māori name beneath. */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={Type.bodyStrong}>{subRegion.name}</Text>
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

      {/* Right: count and chevron together, never shrunk or wrapped, vertically centred. */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexShrink: 0,
          marginLeft: Space.md,
        }}>
        {placeCount !== null ? (
          <Text
            style={{
              color: Palette.textMuted,
              ...Type.label,
              marginRight: Space.sm,
              minWidth: SUBREGION_COUNT_MIN_WIDTH,
              textAlign: 'right',
            }}>
            {placeCount}
          </Text>
        ) : null}
        <IconSymbol color={Palette.textMuted} name="chevron.right" size={16} />
      </View>
    </Pressable>
  );
}
