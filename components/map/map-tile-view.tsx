import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapPlaceTile } from '@/components/map/map-place-tile';
import type { MapPlace } from '@/sanity/types';

type MapTileViewProps = {
  isLoading: boolean;
  onCollapse: () => void;
  onRegionsPress: () => void;
  onQueryChange: (query: string) => void;
  places: MapPlace[];
  query: string;
  selectedFilterCount: number;
};

export function MapTileView({
  isLoading,
  onCollapse,
  onRegionsPress,
  onQueryChange,
  places,
  query,
  selectedFilterCount,
}: MapTileViewProps) {
  const collapseTray = () => {
    Keyboard.dismiss();
    onCollapse();
  };

  return (
    <SafeAreaView style={{ backgroundColor: '#fff', flex: 1 }} edges={['top']}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}>
        <Pressable
          accessibilityLabel="Return to map"
          accessibilityRole="button"
          onPress={collapseTray}
          style={({ pressed }) => ({
            alignItems: 'center',
            height: 42,
            justifyContent: 'center',
            opacity: pressed ? 0.55 : 1,
            width: 42,
          })}>
          <MaterialIcons color="#111" name="keyboard-arrow-down" size={28} />
        </Pressable>

        <Text style={{ fontSize: 15, fontWeight: '800' }}>
          {isLoading
            ? 'Loading places...'
            : `${places.length} ${places.length === 1 ? 'place' : 'places'} in view`}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={onRegionsPress}
          style={({ pressed }) => ({
            alignItems: 'center',
            borderColor: '#dedede',
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 5,
            opacity: pressed ? 0.6 : 1,
            paddingHorizontal: 11,
            paddingVertical: 8,
          })}>
          <MaterialIcons color="#111" name="tune" size={17} />
          <Text style={{ fontSize: 13, fontWeight: '700' }}>Regions</Text>
          {selectedFilterCount > 0 ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: '#111',
                borderRadius: 999,
                height: 18,
                justifyContent: 'center',
                minWidth: 18,
                paddingHorizontal: 5,
              }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                {selectedFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onQueryChange}
        placeholder="Search for trip ideas"
        returnKeyType="search"
        style={{
          backgroundColor: '#f7f7f7',
          borderColor: '#dedede',
          borderRadius: 999,
          borderWidth: 1,
          fontSize: 15,
          marginBottom: 14,
          marginHorizontal: 16,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
        value={query}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: 32,
          paddingHorizontal: 16,
        }}>
        {places.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}>
            {places.map((place, index) => (
              <MapPlaceTile
                key={place._id ?? place.slug?.current ?? index}
                place={place}
              />
            ))}
          </View>
        ) : !isLoading ? (
          <Text
            style={{
              color: '#717171',
              fontSize: 16,
              paddingTop: 30,
              textAlign: 'center',
            }}>
            No places match this map view.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
