import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { Palette, Type } from '@/constants/design';
import type { TripImage } from '@/trips/images';

function CollageImage({
  image,
  onError,
}: {
  image: TripImage;
  onError?: (image: TripImage) => void;
}) {
  return (
    <View style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
      <Image
        accessibilityLabel={image.alt}
        contentFit="cover"
        onError={() => onError?.(image)}
        source={{ uri: image.url }}
        style={{ height: '100%', width: '100%' }}
        transition={150}
      />
    </View>
  );
}

export function TripImageCollage({
  emptyLabel = 'My Trip',
  images,
  onImageError,
  style,
}: {
  emptyLabel?: string;
  images: TripImage[];
  onImageError?: (image: TripImage) => void;
  style?: ViewStyle;
}) {
  const visibleImages = images.slice(0, 4);

  return (
    <View
      style={[
        {
          alignItems: 'stretch',
          backgroundColor: Palette.surfaceMuted,
          flexDirection: 'row',
          gap: 2,
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}>
      {visibleImages.length === 0 ? (
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
          }}>
          <Text style={{ color: Palette.textMuted, ...Type.label }}>
            {emptyLabel}
          </Text>
        </View>
      ) : visibleImages.length <= 2 ? (
        visibleImages.map((image) => (
          <CollageImage image={image} key={image.cacheKey ?? image.url} onError={onImageError} />
        ))
      ) : (
        <>
          <View style={{ flex: 1, gap: 2 }}>
            <CollageImage image={visibleImages[0]} onError={onImageError} />
            {visibleImages.length === 4 ? (
              <CollageImage image={visibleImages[1]} onError={onImageError} />
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            {visibleImages.slice(visibleImages.length === 4 ? 2 : 1).map(
              (image) => (
                <CollageImage image={image} key={image.cacheKey ?? image.url} onError={onImageError} />
              )
            )}
          </View>
        </>
      )}
    </View>
  );
}
