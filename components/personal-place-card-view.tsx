import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { authorizePhotoRead } from '@/notebooks/api';
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
        marginBottom: embedded || compact ? 0 : Space.lg,
        opacity: pressed ? 0.7 : 1,
      })}>
      <CardSurface style={compact ? { flexDirection: 'row', minHeight: 92 } : undefined}>
        {imageUrl ? (
          <MediaFrame
            accessibilityLabel={card.title ?? 'Personal Place photo'}
            aspectRatio={compact ? undefined : 16 / 9}
            radius={0}
            source={{ uri: imageUrl }}
            style={compact ? { height: 92, width: 112 } : undefined}
          />
        ) : compact ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: Palette.surfaceMuted,
              height: 92,
              justifyContent: 'center',
              width: 112,
            }}>
            <MaterialIcons color={Palette.trip} name="place" size={30} />
          </View>
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
