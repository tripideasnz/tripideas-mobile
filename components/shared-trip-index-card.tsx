// One row of Shared With Me, in the same compact whole-row card as My Trips.
import { Pressable, Text, View } from 'react-native';

import { TripImageCollage } from '@/components/trip-image-collage';
import { Palette, Radius, Space, Type } from '@/constants/design';
import type { SharedTripRow } from '@/shared-trips/view-model';

export function SharedTripIndexCard({ onPress, row }: { onPress: () => void; row: SharedTripRow }) {
  return (
    <Pressable
      accessibilityLabel={row.accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: Palette.border,
        borderRadius: Radius.card,
        borderWidth: 1,
        flexDirection: 'row',
        opacity: pressed ? 0.65 : 1,
        overflow: 'hidden',
      })}>
      {/* The list carries no Place images; the card keeps the calm feature label of an empty montage. */}
      <TripImageCollage emptyLabel="Shared" images={[]} style={{ height: 92, width: 112 }} />
      <View style={{ flex: 1, justifyContent: 'center', padding: Space.lg }}>
        <Text numberOfLines={2} style={Type.cardTitle}>{row.title}</Text>
        <Text numberOfLines={1} style={{ color: Palette.textMuted, ...Type.label, marginTop: Space.xs }}>
          {row.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
