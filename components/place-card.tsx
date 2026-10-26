import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { PlaceCardActions, type PlaceTripAction } from '@/components/place-card-actions';
import { PlaceCardPresentation } from '@/components/place-card-presentation';
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

function getDistanceLabel(distanceKm: number | undefined) {
  if (
    typeof distanceKm !== 'number' ||
    !Number.isFinite(distanceKm) ||
    distanceKm < 0
  ) {
    return null;
  }

  const roundedDistance = Math.round(distanceKm * 10) / 10;
  return `${roundedDistance} km away`;
}

export function PlaceCard({
  disabled = false,
  embedded = false,
  navigationOrigin,
  onPress,
  onOpenPlace,
  tripAction,
  place,
  showSaveButton = true,
  showSnippet = false,
}: {
  disabled?: boolean;
  embedded?: boolean;
  navigationOrigin?: 'favourites' | 'search';
  onPress?: () => void;
  onOpenPlace?: () => void;
  tripAction?: PlaceTripAction;
  place: PlaceCardData;
  showSaveButton?: boolean;
  showSnippet?: boolean;
}) {
  const router = useRouter();
  const heading = getPlaceHeading(place);
  const preview = getPlacePreview(place);
  const distanceLabel = getDistanceLabel(place.distanceKm);
  const placeId = place._id;
  const canOpenPlace = Boolean(place.slug?.current);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={onPress ? `Select ${place.title || 'Place'}` : `Open ${place.title || 'Place'}`}
      accessibilityState={{ disabled: disabled || (!onPress && !canOpenPlace) }}
      disabled={disabled || (!onPress && !canOpenPlace)}
      onPress={() => {
        if (onPress) { onPress(); return; }
        if (!place.slug?.current) {
          return;
        }

        onOpenPlace?.();
        router.push({
          pathname: '/place/[slug]',
          params: { slug: place.slug.current, origin: navigationOrigin },
        });
      }}
      style={({ pressed }) => ({
        marginBottom: embedded ? 0 : Space.xxl,
        opacity: disabled ? 0.5 : pressed ? 0.74 : 1,
      })}>
      <PlaceCardPresentation
        media={place.imageUrl ? (
          <MediaFrame
            source={{ uri: place.imageUrl }}
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
            aspectRatio={16 / 9}
            radius={0}
          />
        ) : undefined}
        overlayActions={placeId && showSaveButton ? (
          <PlaceCardActions placeId={placeId} tripAction={tripAction} />
        ) : undefined}
        style={embedded ? {
          borderColor: 'transparent',
          borderRadius: 0,
          borderWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        } : undefined}
        title={place.title}
        titleTrailing={distanceLabel ? (
          <Text
            numberOfLines={1}
            style={{ color: Palette.textMuted, ...Type.label, textAlign: 'right' }}>
            {distanceLabel}
          </Text>
        ) : undefined}>
        {showSnippet && heading ? (
          <Text
            numberOfLines={1}
            style={{ color: Palette.textMuted, ...Type.label, marginTop: Space.sm }}>
            {heading}
          </Text>
        ) : null}
        {showSnippet && preview ? (
          <Text
            numberOfLines={3}
            style={{ color: Palette.textBody, ...Type.body, marginTop: Space.md }}>
            {preview}
          </Text>
        ) : null}
      </PlaceCardPresentation>
    </Pressable>
  );
}
