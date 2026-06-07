import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
  onQueryChange: (query: string) => void;
  onRemoveFilter: (filterId: string) => void;
  places: MapPlace[];
  query: string;
  resultCount: number;
};

export function MapPeekSheet({
  activeFilters,
  isLoading,
  isMinimised,
  onHandlePress,
  onMinimise,
  onQueryChange,
  onRemoveFilter,
  places,
  query,
  resultCount,
}: MapPeekSheetProps) {
  const router = useRouter();
  const handlePress = () => {
    Keyboard.dismiss();
    onHandlePress();
  };
  const minimiseTray = () => {
    Keyboard.dismiss();
    onMinimise();
  };

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
      <Pressable
        accessibilityLabel={
          isMinimised ? 'Open map tray' : 'Open full list view'
        }
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMinimised ? 48 : 36,
          opacity: pressed ? 0.6 : 1,
        })}>
        <View
          style={{
            backgroundColor: '#c9c9c9',
            borderRadius: Radius.pill,
            height: 4,
            width: 42,
          }}
        />
      </Pressable>

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

          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 3,
              paddingVertical: Space.md,
            }}>
            <Text
              style={{ color: Palette.textBody, ...Type.label }}>
              {isLoading
                ? 'Loading places...'
                : `${resultCount} ${
                    resultCount === 1 ? 'place' : 'places'
                  } in view`}
            </Text>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: Space.md,
              }}>
              <Pressable
                accessibilityRole="button"
                onPress={handlePress}
                style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
                <Text
                  style={{ color: Palette.text, ...Type.label }}>
                  List view
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Minimise map tray"
                accessibilityRole="button"
                hitSlop={8}
                onPress={minimiseTray}
                style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
                <MaterialIcons
                  color={Palette.text}
                  name="keyboard-arrow-down"
                  size={25}
                />
              </Pressable>
            </View>
          </View>

          {places.length > 0 ? (
            <ScrollView
              contentContainerStyle={{ gap: Space.md }}
              horizontal
              showsHorizontalScrollIndicator={false}>
              {places.slice(0, 4).map((place, index) => (
                <Pressable
                  disabled={!place.slug?.current}
                  key={place._id ?? place.slug?.current ?? index}
                  onPress={() => {
                    if (!place.slug?.current) {
                      return;
                    }

                    router.push({
                      pathname: '/place/[slug]',
                      params: { slug: place.slug.current },
                    });
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
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
              ))}
            </ScrollView>
          ) : null}
        </>
      )}
    </View>
  );
}
