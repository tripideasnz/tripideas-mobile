import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { PlaceCardActions } from '@/components/place-card-actions';
import { MediaFrame } from '@/components/ui/media-frame';
import { Palette, Radius, Space, Type } from '@/constants/design';
import type { MapPlace } from '@/sanity/types';

export function MapPlaceTile({ place }: { place: MapPlace }) {
  const router = useRouter();
  const placeId = place._id;
  const canOpenPlace = Boolean(place.slug?.current);
  const location = [place.subRegion?.name, place.subRegion?.region?.name]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      disabled={!canOpenPlace}
      onPress={() => {
        if (!place.slug?.current) {
          return;
        }

        router.push({
          pathname: '/place/[slug]',
          params: { slug: place.slug.current },
        });
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : 1,
        width: '48%',
      })}>
      <View>
        {place.imageUrl ? (
          <MediaFrame
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
            source={{ uri: place.imageUrl }}
            radius={Radius.control}
          />
        ) : (
          <View
            style={{
              alignItems: 'center',
              aspectRatio: 4 / 3,
              backgroundColor: Palette.surfaceMuted,
              borderRadius: Radius.control,
              justifyContent: 'center',
            }}>
            <Text style={{ color: Palette.textMuted, ...Type.caption }}>
              No image
            </Text>
          </View>
        )}

        {placeId ? (
          <PlaceCardActions
            buttonStyle={{
              height: 36,
              width: 36,
            }}
            placeId={placeId}
            style={{ left: 8, right: 8, top: 8 }}
          />
        ) : null}
      </View>

      <Text
        numberOfLines={2}
        style={{
          fontSize: 15,
          fontWeight: '700',
          lineHeight: 19,
          marginTop: Space.sm,
        }}>
        {place.title}
      </Text>
      {location ? (
        <Text
          numberOfLines={1}
          style={{
            color: Palette.textMuted,
            fontSize: 12,
            marginTop: Space.xs,
          }}>
          {location}
        </Text>
      ) : null}
    </Pressable>
  );
}
