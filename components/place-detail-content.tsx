import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { PlaceMapPreview } from '@/components/place-map-preview';
import { PlacePhotoGrid } from '@/components/place-photo-grid';
import { Screen, Space, Type } from '@/constants/design';
import { isPersonalPhotoCacheKey } from '@/personal-place-cards/photo-loader';
import type { PlaceGalleryImage } from '@/sanity/types';

export function PlaceDetailContent({
  body,
  children,
  galleryImages = [],
  galleryPosition = 'after-location',
  hero,
  location,
  mapActions,
  onGalleryImageError,
  title,
  titleActions,
}: {
  body?: ReactNode;
  children?: ReactNode;
  galleryImages?: PlaceGalleryImage[];
  galleryPosition?: 'after-location' | 'before-location';
  hero?: { alt: string; cacheKey?: string; onError?: () => void; url: string } | null;
  location?: { latitude: number; longitude: number } | null;
  mapActions?: ReactNode;
  onGalleryImageError?: (image: PlaceGalleryImage) => void;
  title: string;
  titleActions?: ReactNode;
}) {
  return (
    <>
      {hero ? (
        <Image
          accessibilityLabel={hero.alt}
          contentFit="cover"
          onError={hero.onError}
          source={hero.cacheKey ? { cacheKey: hero.cacheKey, uri: hero.url } : { uri: hero.url }}
          style={{ aspectRatio: 16 / 9, width: '100%' }}
          transition={isPersonalPhotoCacheKey(hero.cacheKey) ? 0 : 150}
        />
      ) : null}

      <View
        style={{
          paddingBottom: Space.huge,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: Space.md,
            justifyContent: 'space-between',
            marginBottom: Space.xl,
          }}>
          <Text style={{ flex: 1, ...Type.title }}>{title}</Text>
          {titleActions}
        </View>

        {body ? <View style={{ marginBottom: Space.xl }}>{body}</View> : null}

        {galleryPosition === 'before-location' ? (
          <PlacePhotoGrid images={galleryImages} onImageError={onGalleryImageError ? (image) => onGalleryImageError(image) : undefined} placeTitle={title} />
        ) : null}

        {location ? (
          <View style={{ marginBottom: Space.xxl }}>
            <Text style={{ ...Type.section, marginBottom: Space.md }}>
              Location
            </Text>
            <PlaceMapPreview
              latitude={location.latitude}
              longitude={location.longitude}
              title={title}
            />
            {mapActions}
          </View>
        ) : null}

        {galleryPosition === 'after-location' ? (
          <PlacePhotoGrid images={galleryImages} onImageError={onGalleryImageError ? (image) => onGalleryImageError(image) : undefined} placeTitle={title} />
        ) : null}
        {children}
      </View>
    </>
  );
}
