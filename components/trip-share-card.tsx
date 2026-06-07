import { Text, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { TripImageCollage } from '@/components/trip-image-collage';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/design';
import type { TripShareCardData } from '@/trips/share';

export function TripShareCard({ data }: { data: TripShareCardData }) {
  const placeLabel = `${data.placeCount} ${
    data.placeCount === 1 ? 'place' : 'places'
  }`;

  return (
    <View
      style={{
        ...Shadow.card,
        backgroundColor: Palette.surface,
        borderColor: Palette.border,
        borderRadius: Radius.card,
        borderWidth: 1,
        marginBottom: Space.xxxl,
        overflow: 'hidden',
      }}>
      <TripImageCollage
        images={data.galleryImageUrls.map((url, index) => ({
          alt:
            index === 0
              ? data.coverImageAlt ?? 'Trip cover image'
              : `Trip image ${index + 1}`,
          url,
        }))}
        style={{ aspectRatio: 16 / 9, width: '100%' }}
      />

      <View style={{ padding: Space.xl }}>
        <BrandLogo style={{ height: 36, marginBottom: 16 }} />

        <Text style={Type.title}>
          {data.title}
        </Text>

        {data.note ? (
          <Text
            numberOfLines={4}
            style={{
              color: Palette.textBody,
              ...Type.body,
              marginTop: Space.md,
            }}>
            {data.note}
          </Text>
        ) : null}

        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: Palette.surfaceMuted,
            borderRadius: Radius.pill,
            marginTop: Space.lg,
            paddingHorizontal: Space.md,
            paddingVertical: Space.sm,
          }}>
          <Text style={{ color: Palette.textBody, ...Type.label }}>
            {placeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
