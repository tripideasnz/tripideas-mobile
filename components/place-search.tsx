import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';

import type { PlaceTripAction } from '@/components/place-card-actions';
import { PlaceCard } from '@/components/place-card';
import { AppTextInput } from '@/components/ui/app-text-input';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space } from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { SEARCH_QUERY } from '@/sanity/queries';
import type { PlaceCardData } from '@/types/content';

export function PlaceSearch({
  disabled = false,
  header,
  scrollable = false,
  onPlacePress,
  onOpenPlace,
  getTripAction,
  navigationOrigin,
  placeholder = 'Search TripIdeas Places',
}: {
  disabled?: boolean;
  header?: ReactNode;
  scrollable?: boolean;
  onOpenPlace?: () => void;
  getTripAction?: (place: PlaceCardData) => PlaceTripAction;
  onPlacePress?: (place: PlaceCardData) => void;
  /** Where Places opened from these results should return to (the Search tab). */
  navigationOrigin?: 'search';
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<PlaceCardData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setErrorMessage(null);
      setIsSearching(false);
      return;
    }
    let active = true;
    setIsSearching(true);
    setErrorMessage(null);
    void sanityClient.fetch<PlaceCardData[]>(SEARCH_QUERY, { term: `*${debouncedQuery}*` })
      .then((data) => { if (active) setResults((data ?? []).filter(Boolean)); })
      .catch(() => {
        if (active) {
          setResults([]);
          setErrorMessage('Unable to search places right now.');
        }
      })
      .finally(() => { if (active) setIsSearching(false); });
    return () => { active = false; };
  }, [debouncedQuery]);

  const input = <View style={{ backgroundColor: Palette.background, paddingVertical: Space.sm }}>
    <AppTextInput
      accessibilityLabel="Search TripIdeas Places"
      autoCapitalize="none"
      autoCorrect={false}
      onChangeText={setQuery}
      onSubmitEditing={Keyboard.dismiss}
      placeholder={placeholder}
      returnKeyType="search"
      value={query}
    />
  </View>;
  const resultsContent = <View style={{ gap: Space.md }}>
    {!debouncedQuery ? null : errorMessage ? <StatusText>{errorMessage}</StatusText>
      : isSearching ? <StatusText>Searching...</StatusText>
      : results.length ? results.map((place, index) => <PlaceCard
        disabled={disabled}
        navigationOrigin={navigationOrigin}
        onOpenPlace={onOpenPlace}
        tripAction={getTripAction?.(place)}
        showSaveButton={!onPlacePress}
        key={place._id ?? place.slug?.current ?? index}
        onPress={onPlacePress ? () => onPlacePress(place) : undefined}
        place={place}
      />) : <StatusText>No places found.</StatusText>}
  </View>;
  if (!scrollable) return <View style={{ gap: Space.md }}>{header}{input}{resultsContent}</View>;
  // Keep the one native input outside the scrolling/translated responder tree.
  // Results still dismiss the keyboard on drag; input taps use native focus.
  return <View style={{ flex: 1 }}>
    <View style={{ paddingHorizontal: Screen.gutter, paddingTop: Screen.top }}>
      {header}
      {input}
    </View>
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={Keyboard.dismiss}
      contentContainerStyle={{ paddingHorizontal: Screen.gutter, paddingBottom: Screen.bottom }}>
      {resultsContent}
    </ScrollView>
  </View>;
}
