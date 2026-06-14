import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  FlatList,
  Keyboard,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MapActiveFilters,
  type MapActiveFilter,
} from '@/components/map/map-active-filters';
import { MapPlaceTile } from '@/components/map/map-place-tile';
import { AppTextInput } from '@/components/ui/app-text-input';
import { Palette, Radius, Space, Type } from '@/constants/design';
import type { MapPlace } from '@/sanity/types';

type MapTileViewProps = {
  activeFilters: MapActiveFilter[];
  isLoading: boolean;
  onCollapse: () => void;
  onRegionsPress: () => void;
  onQueryChange: (query: string) => void;
  onRemoveFilter: (filterId: string) => void;
  places: MapPlace[];
  query: string;
  selectedFilterCount: number;
};

export function MapTileView({
  activeFilters,
  isLoading,
  onCollapse,
  onRegionsPress,
  onQueryChange,
  onRemoveFilter,
  places,
  query,
  selectedFilterCount,
}: MapTileViewProps) {
  const collapseTray = () => {
    Keyboard.dismiss();
    onCollapse();
  };

  return (
    <SafeAreaView
      style={{ backgroundColor: Palette.background, flex: 1 }}
      edges={['top']}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: Space.lg,
          paddingVertical: Space.md,
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
          <MaterialIcons color={Palette.text} name="keyboard-arrow-down" size={28} />
        </Pressable>

        <Text style={{ flex: 1, textAlign: 'center', ...Type.label }}>
          {isLoading
            ? 'Loading places...'
            : `${places.length} ${places.length === 1 ? 'place' : 'places'} in view`}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={onRegionsPress}
          style={({ pressed }) => ({
            alignItems: 'center',
            borderColor: Palette.border,
            borderRadius: Radius.pill,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 5,
            opacity: pressed ? 0.6 : 1,
            paddingHorizontal: 11,
            paddingVertical: 8,
          })}>
          <MaterialIcons color={Palette.text} name="tune" size={17} />
          <Text style={Type.label}>Regions</Text>
          {selectedFilterCount > 0 ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: Palette.primary,
                borderRadius: Radius.pill,
                height: 18,
                justifyContent: 'center',
                minWidth: 18,
                paddingHorizontal: 5,
              }}>
              <Text
                style={{
                  color: Palette.textOnPrimary,
                  fontSize: 11,
                  fontWeight: '800',
                }}>
                {selectedFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <AppTextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onQueryChange}
        placeholder="Search for trip ideas"
        returnKeyType="search"
        style={{
          backgroundColor: Palette.surfaceMuted,
          borderRadius: Radius.pill,
          marginBottom: Space.lg,
          marginHorizontal: Space.lg,
          minHeight: 44,
        }}
        value={query}
      />

      {activeFilters.length > 0 ? (
        <View
          style={{
            marginBottom: Space.lg,
            paddingHorizontal: Space.lg,
          }}>
          <MapActiveFilters
            filters={activeFilters}
            onRemove={onRemoveFilter}
          />
        </View>
      ) : null}

      <FlatList
        columnWrapperStyle={{
          gap: Space.md,
          marginBottom: Space.lg,
        }}
        data={places}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: Space.xxxl,
          paddingHorizontal: Space.lg,
        }}
        keyExtractor={(place, index) =>
          place._id ?? place.slug?.current ?? `place-${index}`
        }
        ListEmptyComponent={
          !isLoading ? (
            <Text
              style={{
                color: Palette.textMuted,
                ...Type.body,
                paddingTop: 30,
                textAlign: 'center',
              }}>
              No places match this map view.
            </Text>
          ) : null
        }
        numColumns={2}
        renderItem={({ item }) => <MapPlaceTile place={item} />}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    </SafeAreaView>
  );
}
