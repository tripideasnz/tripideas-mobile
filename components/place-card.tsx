import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { PlaceCardActions } from '@/components/place-card-actions';
import { CardSurface } from '@/components/ui/card-surface';
import { MediaFrame } from '@/components/ui/media-frame';
import { Palette, Space, Type } from '@/constants/design';
import type { PlaceCardData } from '@/types/content';

function getPlaceHeading(place: PlaceCardData) {
  return place.subtitle?.trim() || place.h3?.trim();
}

function getPlacePreview(place: PlaceCardData) {
  const preview = place.excerpt?.trim() || place.preview?.trim();

  if (preview && preview.length > 24) {
    return preview;
  }

  return place.seoDescription?.trim() || preview;
}

export function PlaceCard({
  embedded = false,
  place,
  showSaveButton = true,
  showSnippet = false,
}: {
  embedded?: boolean;
  place: PlaceCardData;
  showSaveButton?: boolean;
  showSnippet?: boolean;
}) {
  const router = useRouter();
  const heading = getPlaceHeading(place);
  const preview = getPlacePreview(place);
  const placeId = place._id;
  const canOpenPlace = Boolean(place.slug?.current);

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
        marginBottom: embedded ? 0 : Space.xxl,
        opacity: pressed ? 0.74 : 1,
      })}>
      <CardSurface
        style={
          embedded
            ? {
                borderColor: 'transparent',
                borderRadius: 0,
                borderWidth: 0,
                elevation: 0,
                shadowOpacity: 0,
              }
            : undefined
        }>
        {place.imageUrl ? (
          <MediaFrame
            source={{ uri: place.imageUrl }}
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
            aspectRatio={16 / 9}
            radius={0}
          />
        ) : null}

        {placeId && showSaveButton ? (
          <PlaceCardActions placeId={placeId} />
        ) : null}

        <View style={{ padding: Space.lg }}>
          <Text numberOfLines={2} style={Type.cardTitle}>
            {place.title}
          </Text>

          {showSnippet && heading ? (
            <Text
              numberOfLines={1}
              style={{
                color: Palette.textMuted,
                ...Type.label,
                marginTop: Space.sm,
              }}>
              {heading}
            </Text>
          ) : null}

          {showSnippet && preview ? (
            <Text
              numberOfLines={3}
              style={{
                color: Palette.textBody,
                ...Type.body,
                marginTop: Space.md,
              }}>
              {preview}
            </Text>
          ) : null}
        </View>
      </CardSurface>
    </Pressable>
  );
}
