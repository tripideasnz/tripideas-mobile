import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { SavePlaceButton } from '@/components/save-place-button';
import { useSavedPlaces } from '@/saved/provider';
import type { MapPlace } from '@/sanity/types';

export function MapPlaceTile({ place }: { place: MapPlace }) {
  const router = useRouter();
  const { isSaved, toggleSavedPlace } = useSavedPlaces();
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
      <View
        style={{
          aspectRatio: 4 / 3,
          backgroundColor: '#e8e8e5',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
        {place.imageUrl ? (
          <Image
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
            contentFit="cover"
            source={{ uri: place.imageUrl }}
            style={{ height: '100%', width: '100%' }}
          />
        ) : (
          <View
            style={{
              alignItems: 'center',
              flex: 1,
              justifyContent: 'center',
            }}>
            <Text style={{ color: '#858585', fontSize: 13 }}>No image</Text>
          </View>
        )}

        {placeId ? (
          <SavePlaceButton
            isSaved={isSaved(placeId)}
            onPress={(event) => {
              event.stopPropagation();
              void toggleSavedPlace(placeId);
            }}
            style={{
              height: 36,
              position: 'absolute',
              right: 8,
              top: 8,
              width: 36,
            }}
          />
        ) : null}
      </View>

      <Text
        numberOfLines={2}
        style={{
          fontSize: 15,
          fontWeight: '700',
          lineHeight: 19,
          marginTop: 8,
        }}>
        {place.title}
      </Text>
      {location ? (
        <Text
          numberOfLines={1}
          style={{ color: '#717171', fontSize: 12, marginTop: 2 }}>
          {location}
        </Text>
      ) : null}
    </Pressable>
  );
}
