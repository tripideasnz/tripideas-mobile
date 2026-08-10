import { Pressable, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { TripImageCollage } from '@/components/trip-image-collage';
import { Palette, Radius, Space, Type } from '@/constants/design';
import type { TripImage } from '@/trips/images';
import type { MyTrip } from '@/trips/types';

export function TripIndexCard({
  accessibilityLabel,
  images,
  onPress,
  style,
  trip,
}: {
  accessibilityLabel?: string;
  images: TripImage[];
  onPress?: () => void;
  style?: ViewStyle;
  trip: MyTrip;
}) {
  const placeCount = trip.entries?.length ?? trip.places.length;
  const content = (
    <>
      <TripImageCollage images={images} style={{ height: 92, width: 112 }} />
      <View style={{ flex: 1, justifyContent: 'center', padding: Space.lg, paddingRight: 60 }}>
        <Text numberOfLines={2} style={Type.cardTitle}>{trip.name}</Text>
        <Text style={{ color: Palette.textMuted, ...Type.label, marginTop: Space.xs }}>
          {placeCount} {placeCount === 1 ? 'place' : 'places'}
        </Text>
      </View>
    </>
  );
  const surface: ViewStyle = {
    borderColor: Palette.border,
    borderRadius: Radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    ...style,
  };

  if (!onPress) return <View style={surface}>{content}</View>;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ ...surface, opacity: pressed ? 0.65 : 1 })}>
      {content}
    </Pressable>
  );
}
