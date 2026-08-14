import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { authorizePhotoRead } from '@/notebooks/api';
import { TripImageCollage } from '@/components/trip-image-collage';
import { CardSurface } from '@/components/ui/card-surface';
import { MediaFrame } from '@/components/ui/media-frame';
import { Palette, Space, Type } from '@/constants/design';
import type { PersonalPlaceCard } from '@/personal-place-cards/types';

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
  const coverMedia = [
    ...card.media.filter((item) => item.role === 'main'),
    ...card.media.filter((item) => item.role === 'body'),
  ].slice(0, 4);
  const coverKey = coverMedia.map((item) => item.photoAssetId).join('|');
  const [coverImages, setCoverImages] = useState<
    { alt: string; cacheKey: string; url: string }[]
  >([]);
  useEffect(() => {
    let mounted = true;
    setCoverImages([]);
    void Promise.all(coverMedia.map(async (media) => {
      try {
        const result = await authorizePhotoRead(media.photoAssetId);
        return {
          alt: card.title ?? 'Personal Place photo',
          cacheKey: media.photoAssetId,
          url: result.url,
        };
      } catch {
        return null;
      }
    })).then((images) => {
      if (mounted) setCoverImages(images.filter((image): image is NonNullable<typeof image> => image !== null));
    });
    return () => { mounted = false; };
    // Photo IDs are the stable cover identity; title changes only affect fallback alt text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverKey]);

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
            style={{ height: 92, width: 112 }}
          />
        ) : coverImages[0] ? (
          <MediaFrame
            accessibilityLabel={card.title ?? 'Personal Place photo'}
            aspectRatio={16 / 9}
            radius={0}
            source={{ uri: coverImages[0].url }}
          />
        ) : null}
        <View style={{ flex: 1, justifyContent: 'center', padding: Space.lg, paddingRight: compact ? 60 : Space.lg }}>
          <Text numberOfLines={2} style={Type.cardTitle}>{card.title || 'Untitled Personal Place'}</Text>
          {card.body ? (
            <Text
              numberOfLines={compact ? 1 : 3}
              style={{ color: Palette.textBody, ...Type.body, marginTop: Space.sm }}>
              {card.body}
            </Text>
          ) : null}
        </View>
      </CardSurface>
    </Pressable>
  );
}
