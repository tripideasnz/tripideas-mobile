import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  MapActiveFilters,
  type MapActiveFilter,
} from '@/components/map/map-active-filters';
import { AppTextInput } from '@/components/ui/app-text-input';
import {
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
} from '@/constants/design';
import type { MapPlace } from '@/sanity/types';

type MapPeekSheetProps = {
  activeFilters: MapActiveFilter[];
  isLoading: boolean;
  isMinimised: boolean;
  onHandlePress: () => void;
  onMinimise: () => void;
  onPlacePress: (place: MapPlace) => void;
  onQueryChange: (query: string) => void;
  onRemoveFilter: (filterId: string) => void;
  places: MapPlace[];
  query: string;
  resultCount: number;
  selectedPlaceId: string | null;
};

export function MapPeekSheet({
  activeFilters,
  isLoading,
  isMinimised,
  onHandlePress,
  onMinimise,
  onPlacePress,
  onQueryChange,
  onRemoveFilter,
  places,
  query,
  resultCount,
  selectedPlaceId,
}: MapPeekSheetProps) {
  const placesRef = useRef<ScrollView>(null);
  useEffect(() => {
    const index = places.findIndex((place) => (place._id ?? place.slug?.current) === selectedPlaceId);
    if (index >= 0) placesRef.current?.scrollTo({ animated: true, x: Math.max(0, index * (142 + Space.md) - Space.md) });
  }, [places, selectedPlaceId]);

  const countLabel = isLoading
    ? 'Loading...'
    : `${resultCount} ${resultCount === 1 ? 'place' : 'places'} in view`;

  return (
    <View
      style={{
        ...Shadow.sheet,
        backgroundColor: Palette.surface,
        borderTopLeftRadius: Radius.sheet,
        borderTopRightRadius: Radius.sheet,
        paddingBottom: Space.md,
        paddingHorizontal: Space.md,
        paddingTop: Space.xs,
      }}>
      {/* Header row: [↓ or spacer] | count | [↑] */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          minHeight: isMinimised ? 48 : 44,
        }}>
        {isMinimised ? (
          <View style={{ width: 44 }} />
        ) : (
          <Pressable
            accessibilityLabel="Minimise map tray"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              Keyboard.dismiss();
              onMinimise();
            }}
            style={({ pressed }) => ({
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
              width: 44,
            })}>
            <MaterialIcons
              color={Palette.textMuted}
              name="keyboard-arrow-down"
              size={28}
            />
          </Pressable>
        )}

        <Text
          style={{
            color: Palette.text,
            flex: 1,
            textAlign: 'center',
            ...Type.label,
          }}>
          {countLabel}
        </Text>

        <Pressable
          accessibilityLabel={isMinimised ? 'Expand map tray' : 'Open full list view'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            Keyboard.dismiss();
            onHandlePress();
          }}
          style={({ pressed }) => ({
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.55 : 1,
            width: 44,
          })}>
          <MaterialIcons
            color={Palette.textMuted}
            name="keyboard-arrow-up"
            size={28}
          />
        </Pressable>
      </View>

      {isMinimised ? null : (
        <>
          <AppTextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onQueryChange}
            placeholder="Search for trip ideas"
            returnKeyType="search"
            style={{
              backgroundColor: Palette.surfaceMuted,
              borderRadius: Radius.pill,
              minHeight: 44,
            }}
            value={query}
          />

          {activeFilters.length > 0 ? (
            <View style={{ paddingTop: Space.md }}>
              <MapActiveFilters
                filters={activeFilters}
                onRemove={onRemoveFilter}
              />
            </View>
          ) : null}

          {places.length > 0 ? (
            <ScrollView
              ref={placesRef}
              contentContainerStyle={{ gap: Space.md, paddingTop: Space.md }}
              horizontal
              showsHorizontalScrollIndicator={false}>
              {places.map((place, index) => {
                const placeId = place._id ?? place.slug?.current ?? null; const selected = placeId === selectedPlaceId;
                return (
                <Pressable
                  accessibilityLabel={`${place.title || 'Place'}${selected ? ', selected. Activate again to open.' : ''}`}
                  disabled={!place.slug?.current}
                  key={place._id ?? place.slug?.current ?? index}
                  onPress={() => onPlacePress(place)}
                  style={({ pressed }) => ({
                    borderColor: selected ? Palette.trip : 'transparent',
                    borderRadius: Radius.small,
                    borderWidth: 2,
                    opacity: pressed ? 0.7 : 1,
                    padding: 2,
                    width: 142,
                  })}>
                  <View
                    style={{
                      aspectRatio: 4 / 3,
                      backgroundColor: Palette.surfaceMuted,
                      borderRadius: Radius.small,
                      overflow: 'hidden',
                    }}>
                    {place.imageUrl ? (
                      <Image
                        accessibilityLabel={
                          place.imageAlt ?? place.title ?? 'Place image'
                        }
                        contentFit="cover"
                        source={{ uri: place.imageUrl }}
                        style={{ height: '100%', width: '100%' }}
                      />
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      ...Type.label,
                      fontSize: 13,
                      marginTop: Space.sm,
                    }}>
                    {place.title}
                  </Text>
                  {place.subRegion?.name ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        color: Palette.textMuted,
                        fontSize: 11,
                        marginTop: 2,
                      }}>
                      {place.subRegion.name}
                    </Text>
                  ) : null}
                </Pressable>
              ); })}
            </ScrollView>
          ) : null}
        </>
      )}
    </View>
  );
}
