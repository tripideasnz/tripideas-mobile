import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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
import {
  indexOfSelectedPlace,
  PEEK_ITEM_WIDTH,
  peekItemLayout,
  peekScrollOffset,
} from '@/components/map/peek-list';
import {
  settledSheetHeight,
  sheetHeightAtProgress,
  sheetProgressTarget,
  type MapTrayState,
} from '@/components/map/tray-motion';
import { TRAY_TIMING_CONFIG } from '@/components/map/tray-timing';
import type { MapPlace } from '@/sanity/types';

// Used for the first frame, before the tray's own content has been measured.
const INITIAL_EXPANDED_HEIGHT = 289;

const PeekSeparator = () => <View style={{ width: Space.md }} />;

const placeKey = (place: MapPlace, index: number) =>
  place._id ?? place.slug?.current ?? String(index);

// One thumbnail. Memoised: a viewport change or a selection elsewhere only
// re-renders the items whose place or selected state actually changed.
const PeekPlaceItem = memo(function PeekPlaceItem({
  onPress,
  place,
  selected,
}: {
  onPress: (place: MapPlace) => void;
  place: MapPlace;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityHint="Opens the place."
      accessibilityLabel={`${place.title || 'Place'}${selected ? ', selected' : ''}`}
      disabled={!place.slug?.current}
      onPress={() => onPress(place)}
      style={({ pressed }) => ({
        borderColor: selected ? Palette.trip : 'transparent',
        borderRadius: Radius.small,
        borderWidth: 2,
        opacity: pressed ? 0.7 : 1,
        padding: 2,
        width: PEEK_ITEM_WIDTH,
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
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
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
  );
});

type MapPeekSheetProps = {
  activeFilters: MapActiveFilter[];
  isLoading: boolean;
  isMinimised: boolean;
  onHandlePress: () => void;
  onMinimise: () => void;
  /** Called with the height the tray settles at, never during the transition. */
  onSettledHeight?: (height: number) => void;
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
  onSettledHeight,
  onPlacePress,
  onQueryChange,
  onRemoveFilter,
  places,
  query,
  resultCount,
  selectedPlaceId,
}: MapPeekSheetProps) {
  const placesRef = useRef<FlatList<MapPlace>>(null);
  useEffect(() => {
    const index = indexOfSelectedPlace(places, selectedPlaceId);
    if (index >= 0) placesRef.current?.scrollToOffset({ animated: true, offset: peekScrollOffset(index, Space.md) });
  }, [places, selectedPlaceId]);

  const renderPlace = useCallback(
    ({ item }: { item: MapPlace }) => (
      <PeekPlaceItem
        onPress={onPlacePress}
        place={item}
        selected={(item._id ?? item.slug?.current ?? null) === selectedPlaceId}
      />
    ),
    [onPlacePress, selectedPlaceId]
  );

  // ── Transition ────────────────────────────────────────────────────────────
  // The tray's content stays mounted. Only its height (and the list's opacity)
  // change, driven by one progress value on the UI thread: 0 minimised, 1 expanded.
  // Retargeting that value mid-flight reverses smoothly from wherever it is, so rapid
  // taps never queue animations. The rest of the screen is told the height only once
  // it has settled, so camera padding is not recomputed on every frame.
  const progress = useSharedValue(sheetProgressTarget(isMinimised ? 'minimised' : 'peek'));
  const expandedHeight = useSharedValue(INITIAL_EXPANDED_HEIGHT);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const animating = useRef(false);
  const hasMounted = useRef(false);
  const latest = useRef({ isMinimised, naturalHeight, onSettledHeight });
  latest.current = { isMinimised, naturalHeight, onSettledHeight };

  const reportSettled = useCallback(() => {
    const { isMinimised: minimised, naturalHeight: height, onSettledHeight: report } = latest.current;
    if (height > 0) report?.(settledSheetHeight((minimised ? 'minimised' : 'peek') as MapTrayState, height));
  }, []);
  const finishTransition = useCallback(() => {
    animating.current = false;
    reportSettled();
  }, [reportSettled]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    animating.current = true;
    progress.value = withTiming(
      sheetProgressTarget(isMinimised ? 'minimised' : 'peek'),
      TRAY_TIMING_CONFIG,
      (finished) => {
        // An interrupted transition never reports: the one that replaced it will.
        if (finished) scheduleOnRN(finishTransition);
      }
    );
  }, [isMinimised, finishTransition, progress]);

  // Initial measurement and content changes (filters, results) while at rest.
  useEffect(() => {
    if (!animating.current) reportSettled();
  }, [naturalHeight, isMinimised, reportSettled]);

  const sheetStyle = useAnimatedStyle(() => ({ height: sheetHeightAtProgress(progress.value, expandedHeight.value) }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const countLabel = isLoading
    ? 'Loading...'
    : `${resultCount} ${resultCount === 1 ? 'place' : 'places'} in view`;

  return (
    <Animated.View
      style={[
        {
          ...Shadow.sheet,
          backgroundColor: Palette.surface,
          borderTopLeftRadius: Radius.sheet,
          borderTopRightRadius: Radius.sheet,
        },
        sheetStyle,
      ]}>
      <View
        style={{
          borderTopLeftRadius: Radius.sheet,
          borderTopRightRadius: Radius.sheet,
          flex: 1,
          overflow: 'hidden',
        }}>
        <View
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            expandedHeight.value = height;
            setNaturalHeight(height);
          }}
          style={{
            left: 0,
            paddingBottom: Space.md,
            paddingHorizontal: Space.md,
            paddingTop: Space.xs,
            position: 'absolute',
            right: 0,
            top: 0,
          }}>
          {/* Header row: [↓ or spacer] | count | [↑] */}
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              minHeight: 44,
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

          {/* Stays mounted while minimised: it is clipped away, faded out and inert. */}
          <Animated.View
            accessibilityElementsHidden={isMinimised}
            importantForAccessibility={isMinimised ? 'no-hide-descendants' : 'auto'}
            pointerEvents={isMinimised ? 'none' : 'auto'}
            style={bodyStyle}>
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
              <FlatList
                ref={placesRef}
                contentContainerStyle={{ paddingTop: Space.md }}
                data={places}
                extraData={selectedPlaceId}
                // Virtualised: only thumbnails near the viewport are mounted, so
                // image requests follow what the user can actually scroll to.
                getItemLayout={(_, index) => peekItemLayout(index, Space.md)}
                horizontal
                initialNumToRender={6}
                ItemSeparatorComponent={PeekSeparator}
                keyboardShouldPersistTaps="handled"
                keyExtractor={placeKey}
                maxToRenderPerBatch={6}
                renderItem={renderPlace}
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                windowSize={5}
              />
            ) : null}
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}
