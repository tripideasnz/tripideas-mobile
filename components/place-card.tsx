import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export type PlaceCardData = {
  _id?: string;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  h3?: string;
  imageAlt?: string;
  imageUrl?: string;
  preview?: string;
  seoDescription?: string;
  slug?: {
    current?: string;
  };
};

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

export function PlaceCard({ place }: { place: PlaceCardData }) {
  const heading = getPlaceHeading(place);
  const preview = getPlacePreview(place);

  return (
    <Link
      href={{
        pathname: '/place/[slug]',
        params: { slug: place.slug?.current ?? '' },
      }}
      asChild>
      <Pressable
        disabled={!place.slug?.current}
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
        {place.imageUrl ? (
          <Image
            source={{ uri: place.imageUrl }}
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
            style={{ aspectRatio: 16 / 9, width: '100%' }}
            contentFit="cover"
          />
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
          <Text numberOfLines={2} style={{ fontSize: 20, fontWeight: '700' }}>
            {place.title ?? 'Untitled place'}
          </Text>

          {heading ? (
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

          {preview ? (
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
    </Link>
  );
}
