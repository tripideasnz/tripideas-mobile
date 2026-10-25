import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TripImageCollage } from '@/components/trip-image-collage';
import { CardSurface } from '@/components/ui/card-surface';
import { MediaFrame } from '@/components/ui/media-frame';
import { Palette, Space, Type } from '@/constants/design';
import type { PersonalPlaceCard } from '@/personal-place-cards/types';
import { usePersonalPhotos } from '@/personal-place-cards/use-personal-photos';
import type { TripImage } from '@/trips/images';

export function PersonalPlaceCardView({
  card,
  compact = false,
  embedded = false,
  onPress,
}: {
  card: PersonalPlaceCard;
  compact?: boolean;
  embedded?: boolean;
  onPress?: () => void;
}) {
  const router = useRouter();
  // Main photo first, then body photos, up to four. Only these are authorised,
  // and only while this card is mounted (visible in a virtualised list).
  const coverMedia = [
    ...card.media.filter((item) => item.role === 'main'),
    ...card.media.filter((item) => item.role === 'body'),
  ].slice(0, 4);
  const photos = usePersonalPhotos(coverMedia.map((media) => media.photoAssetId));
  // Reveal the images together once each has loaded or failed, so the collage
  // layout does not reflow while photos arrive.
  const settled = coverMedia.every((media) => {
    const photo = photos.get(media.photoAssetId);
    return photo !== null && photo.status !== 'loading';
  });
  const coverImages: TripImage[] = !settled ? [] : coverMedia.flatMap((media) => {
    const photo = photos.get(media.photoAssetId);
    if (!photo) return [];
    return [{
      alt: card.title ?? 'Personal Place photo',
      cacheKey: photo.cacheKey,
      failed: photo.status === 'failed',
      photoAssetId: media.photoAssetId,
      url: photo.url ?? '',
    }];
  });
  const firstImage = coverImages[0];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => router.push({
        pathname: '/personal-place-cards/[cardId]',
        params: { cardId: card.id, mode: 'view' },
      }))}
      style={({ pressed }) => ({
        marginBottom: embedded || compact ? 0 : Space.lg,
        opacity: pressed ? 0.7 : 1,
      })}>
      <CardSurface style={compact ? { flexDirection: 'row', minHeight: 92 } : undefined}>
        {compact ? (
          <TripImageCollage
            emptyLabel="Personal Place"
            images={coverImages}
            onImageError={(image) => image.photoAssetId && photos.reportError(image.photoAssetId, image.url)}
            onImageRetry={(image) => image.photoAssetId && photos.retry(image.photoAssetId)}
            style={{ height: 92, width: 112 }}
          />
        ) : firstImage?.failed ? (
          <Pressable
            accessibilityLabel="Photo unavailable. Tap to retry."
            accessibilityRole="button"
            onPress={() => firstImage.photoAssetId && photos.retry(firstImage.photoAssetId)}
            style={{
              alignItems: 'center',
              aspectRatio: 16 / 9,
              backgroundColor: Palette.surfaceMuted,
              justifyContent: 'center',
              width: '100%',
            }}>
            <Text style={{ color: Palette.textMuted, ...Type.label }}>Photo unavailable. Tap to retry.</Text>
          </Pressable>
        ) : firstImage ? (
          <MediaFrame
            accessibilityLabel={card.title ?? 'Personal Place photo'}
            aspectRatio={16 / 9}
            onError={() => firstImage.photoAssetId && photos.reportError(firstImage.photoAssetId, firstImage.url)}
            radius={0}
            source={{ cacheKey: firstImage.cacheKey, uri: firstImage.url }}
          />
        ) : null}
        <View style={{ flex: 1, justifyContent: 'center', padding: Space.lg, paddingRight: compact ? 60 : Space.lg }}>
          <Text numberOfLines={2} style={Type.cardTitle}>{card.title || 'Untitled Personal Place'}</Text>
          {card.body ? (
            <Text
              numberOfLines={compact ? 1 : 3}
              style={{
                color: compact ? Palette.textMuted : Palette.textBody,
                ...(compact ? Type.label : Type.body),
                marginTop: compact ? Space.xs : Space.sm,
              }}>
              {card.body}
            </Text>
          ) : null}
        </View>
      </CardSurface>
    </Pressable>
  );
}
