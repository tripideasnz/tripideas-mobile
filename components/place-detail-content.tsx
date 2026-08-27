import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { PlaceMapPreview } from '@/components/place-map-preview';
import { PlacePhotoGrid } from '@/components/place-photo-grid';
import { Screen, Space, Type } from '@/constants/design';
import type { PlaceGalleryImage } from '@/sanity/types';

export function PlaceDetailContent({
  body,
  children,
  galleryImages = [],
  galleryPosition = 'after-location',
  hero,
  location,
  mapActions,
  title,
  titleActions,
}: {
  body?: ReactNode;
  children?: ReactNode;
  galleryImages?: PlaceGalleryImage[];
  galleryPosition?: 'after-location' | 'before-location';
  hero?: { alt: string; url: string } | null;
  location?: { latitude: number; longitude: number } | null;
  mapActions?: ReactNode;
  title: string;
  titleActions?: ReactNode;
}) {
  return (
    <>
      {hero ? (
        <Image
          accessibilityLabel={hero.alt}
          contentFit="cover"
          source={{ uri: hero.url }}
          style={{ aspectRatio: 16 / 9, width: '100%' }}
          transition={150}
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
          <PlacePhotoGrid images={galleryImages} placeTitle={title} />
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
          <PlacePhotoGrid images={galleryImages} placeTitle={title} />
        ) : null}
        {children}
      </View>
    </>
  );
}
