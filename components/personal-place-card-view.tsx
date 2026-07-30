import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { authorizePhotoRead } from '@/notebooks/api';
import { CardSurface } from '@/components/ui/card-surface';
import { MediaFrame } from '@/components/ui/media-frame';
import { Palette, Space, Type } from '@/constants/design';
import type { PersonalPlaceCard } from '@/personal-place-cards/types';

export function PersonalPlaceCardView({
  card,
  embedded = false,
  onPress,
}: {
  card: PersonalPlaceCard;
  embedded?: boolean;
  onPress?: () => void;
}) {
  const router = useRouter();
  const main = card.media.find((item) => item.role === 'main');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    setImageUrl(null);
    if (main) {
      void authorizePhotoRead(main.photoAssetId)
        .then((result) => { if (mounted) setImageUrl(result.url); })
        .catch(() => { if (mounted) setImageUrl(null); });
    }
    return () => { mounted = false; };
  }, [main]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => router.push({
        pathname: '/personal-place-cards/[cardId]',
        params: { cardId: card.id },
      }))}
      style={({ pressed }) => ({
        marginBottom: embedded ? 0 : Space.lg,
        opacity: pressed ? 0.7 : 1,
      })}>
      <CardSurface>
        {imageUrl ? (
          <MediaFrame
            accessibilityLabel={card.title ?? 'Personal Place photo'}
            aspectRatio={16 / 9}
            radius={0}
            source={{ uri: imageUrl }}
          />
        ) : null}
        <View style={{ padding: Space.lg }}>
          <Text style={Type.cardTitle}>{card.title || 'Untitled Personal Place'}</Text>
          {card.body ? (
            <Text
              numberOfLines={3}
              style={{ color: Palette.textBody, ...Type.body, marginTop: Space.sm }}>
              {card.body}
            </Text>
          ) : null}
          <Text style={{ color: Palette.textMuted, ...Type.label, marginTop: Space.sm }}>
            {card.readiness.isTripIdeaReady ? 'Ready for Trips' : 'Needs details'}
          </Text>
        </View>
      </CardSurface>
    </Pressable>
  );
}
