import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { SavePlaceButton } from '@/components/save-place-button';
import { useSavedPlaces } from '@/saved/provider';
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
  place,
  showSaveButton = true,
  showSnippet = false,
}: {
  place: PlaceCardData;
  showSaveButton?: boolean;
  showSnippet?: boolean;
}) {
  const router = useRouter();
  const { isSaved, toggleSavedPlace } = useSavedPlaces();
  const heading = getPlaceHeading(place);
  const preview = getPlacePreview(place);
  const placeId = place._id;
  const placeIsSaved = isSaved(placeId);
  const canOpenPlace = Boolean(place.slug?.current);
  const canSavePlace = Boolean(placeId);

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
      <View>
        {place.imageUrl ? (
          <Image
            source={{ uri: place.imageUrl }}
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
            style={{ aspectRatio: 16 / 9, width: '100%' }}
            contentFit="cover"
          />
        ) : null}

        {canSavePlace && showSaveButton ? (
          <SavePlaceButton
            isSaved={placeIsSaved}
            onPress={(event) => {
              event.stopPropagation();
              void toggleSavedPlace(placeId);
            }}
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
            }}
          />
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        <Text numberOfLines={2} style={{ fontSize: 20, fontWeight: '700' }}>
          {place.title ?? 'Untitled place'}
        </Text>

        {showSnippet && heading ? (
          <Text
            numberOfLines={1}
            style={{
              color: '#717171',
              fontSize: 14,
              fontWeight: '600',
              marginTop: 6,
            }}>
            {heading}
          </Text>
        ) : null}

        {showSnippet && preview ? (
          <Text
            numberOfLines={3}
            style={{
              color: '#4a4a4a',
              fontSize: 15,
              lineHeight: 21,
              marginTop: 10,
            }}>
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
