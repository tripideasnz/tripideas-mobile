import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

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
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}>
          <Text style={{ fontSize: 28, fontWeight: '700' }}>Add to My Trip</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </View>

        {trips.length === 0 ? (
          <Text style={{ color: '#717171', fontSize: 16, lineHeight: 23 }}>
            Create a trip from the Saved screen first, then add this place.
          </Text>
        ) : (
          <ScrollView>
            {trips.map((trip) => {
              const alreadyAdded = trip.places.some(
                (place) => place.placeId === placeId
              );

              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={alreadyAdded}
                  key={trip.id}
                  onPress={() => onSelectTrip(trip.id)}
                  style={{
                    borderColor: '#e2e2e2',
                    borderRadius: 12,
                    borderWidth: 1,
                    marginBottom: 12,
                    opacity: alreadyAdded ? 0.55 : 1,
                    padding: 16,
                  }}>
                  <Text style={{ fontSize: 18, fontWeight: '700' }}>
                    {trip.name}
                  </Text>
                  <Text
                    style={{ color: '#717171', fontSize: 14, marginTop: 5 }}>
                    {alreadyAdded
                      ? 'Already in this trip'
                      : `${trip.places.length} ${
                          trip.places.length === 1 ? 'place' : 'places'
                        }`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
