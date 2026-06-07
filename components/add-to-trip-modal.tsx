import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { CardSurface } from '@/components/ui/card-surface';
import { Palette, Space, Type } from '@/constants/design';
import type { MyTrip } from '@/trips/types';

type AddToTripModalProps = {
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
  placeId: string | null;
  trips: MyTrip[];
};

export function AddToTripModal({
  onClose,
  onSelectTrip,
  placeId,
  trips,
}: AddToTripModalProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={Boolean(placeId)}>
      <View
        style={{
          backgroundColor: Palette.background,
          flex: 1,
          padding: Space.xxl,
        }}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: Space.xxl,
          }}>
          <AppText variant="title">Add to My Trip</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => ({
              opacity: pressed ? 0.45 : 1,
              paddingHorizontal: 4,
              paddingVertical: 8,
            })}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </View>

        {trips.length === 0 ? (
          <AppText color={Palette.textMuted}>
            Create a trip from the Saved screen first, then add this place.
          </AppText>
        ) : (
          <ScrollView>
            {trips.map((trip) => {
              const alreadyAdded = trip.places.some(
                (place) => place.placeId === placeId
              );

              return (
                <Pressable
                  accessibilityRole="button"
                  key={trip.id}
                  onPress={() => onSelectTrip(trip.id)}
                  style={({ pressed }) => ({
                    marginBottom: Space.md,
                    opacity: pressed ? 0.55 : alreadyAdded ? 0.75 : 1,
                  })}>
                  <CardSurface style={{ padding: Space.lg }}>
                    <Text style={Type.cardTitle}>{trip.name}</Text>
                    <Text
                      style={{
                        color: Palette.textMuted,
                        ...Type.label,
                        marginTop: Space.xs,
                      }}>
                      {alreadyAdded
                        ? 'Already in this trip'
                        : `${trip.places.length} ${
                            trip.places.length === 1 ? 'place' : 'places'
                          }`}
                    </Text>
                  </CardSurface>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
