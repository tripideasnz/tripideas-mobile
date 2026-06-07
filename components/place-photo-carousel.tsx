import { Image } from 'expo-image';
import { useState } from 'react';
import {
  FlatList,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import type { PlaceGalleryImage } from '@/sanity/types';

export function PlacePhotoCarousel({
  images,
  placeTitle,
}: {
  images: PlaceGalleryImage[];
  placeTitle?: string;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const itemWidth = windowWidth - Screen.gutter * 2;

  if (images.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: Space.xxl }}>
      <FlatList
        data={images}
        decelerationRate="fast"
        horizontal
        keyExtractor={(image, index) => image._key ?? image.url ?? String(index)}
        onMomentumScrollEnd={(event) => {
          setActiveIndex(
            Math.round(event.nativeEvent.contentOffset.x / itemWidth)
          );
        }}
        pagingEnabled
        renderItem={({ item, index }) => (
          <Image
            accessibilityLabel={
              item.alt ??
              `${placeTitle ?? 'Place'} photo ${index + 1} of ${images.length}`
            }
            contentFit="cover"
            source={{ uri: item.url }}
            style={{
              aspectRatio: 4 / 3,
              backgroundColor: Palette.surfaceMuted,
              borderRadius: Radius.card,
              width: itemWidth,
            }}
            transition={150}
          />
        )}
        showsHorizontalScrollIndicator={false}
        style={{ borderRadius: Radius.card }}
      />

      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: Space.sm,
        }}>
        <Text style={{ color: Palette.textMuted, ...Type.caption }}>
          {activeIndex + 1} / {images.length}
        </Text>
      </View>
    </View>
  );
}
