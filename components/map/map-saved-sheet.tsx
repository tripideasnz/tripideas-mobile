import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapContentSelection } from '@/components/map/map-selection';
import type { MyTrip } from '@/trips/types';

type MapSavedSheetProps = {
  onClose: () => void;
  onSelect: (selection: MapContentSelection) => void;
  selection: MapContentSelection;
  trips: MyTrip[];
  visible: boolean;
};

export function MapSavedSheet({
  onClose,
  onSelect,
  selection,
  trips,
  visible,
}: MapSavedSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}>
      <SafeAreaView style={{ backgroundColor: '#fff', flex: 1 }}>
        <View
          style={{
            alignItems: 'center',
            borderBottomColor: '#e5e5e5',
            borderBottomWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}>
          <Pressable
            accessibilityLabel="Apply filter"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
            <Text style={{ color: '#0080C8', fontSize: 17, fontWeight: '700' }}>Apply</Text>
          </Pressable>
          <Text style={{ fontSize: 19, fontWeight: '800' }}>Saved</Text>
          <Pressable
            accessibilityLabel="Close without applying"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => ({
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
              width: 42,
            })}>
            <MaterialIcons color="#4a4a4a" name="close" size={22} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <SavedRow
            icon="favorite"
            isSelected={selection.type === 'favourites'}
            label="Favourites"
            onPress={() => onSelect({ type: 'favourites' })}
          />

          <Text
            style={{
              fontSize: 22,
              fontWeight: '800',
              marginBottom: 6,
              marginTop: 26,
            }}>
            My Trips
          </Text>
          {trips.length > 0 ? (
            trips.map((trip) => (
              <SavedRow
                icon="folder"
                isSelected={
                  selection.type === 'trip' && selection.tripId === trip.id
                }
                key={trip.id}
                label={trip.name}
                onPress={() =>
                  onSelect({
                    label: trip.name,
                    tripId: trip.id,
                    type: 'trip',
                  })
                }
                subtitle={`${trip.places.length} ${
                  trip.places.length === 1 ? 'place' : 'places'
                }`}
              />
            ))
          ) : (
            <Text style={{ color: '#717171', fontSize: 15 }}>
              No trips yet.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SavedRow({
  icon,
  isSelected,
  label,
  onPress,
  subtitle,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  isSelected: boolean;
  label: string;
  onPress: () => void;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderBottomColor: '#e7e7e7',
        borderBottomWidth: 1,
        flexDirection: 'row',
        minHeight: 60,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: 8,
      })}>
      <MaterialIcons
        color={isSelected ? '#111' : '#717171'}
        name={icon}
        size={22}
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '400' }}>{label}</Text>
        {subtitle ? (
          <Text style={{ color: '#717171', fontSize: 13, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isSelected ? (
        <MaterialIcons color="#111" name="check-circle" size={22} />
      ) : null}
    </Pressable>
  );
}
