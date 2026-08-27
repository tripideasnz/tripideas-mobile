import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { AppTextInput } from '@/components/ui/app-text-input';
import { StatusText } from '@/components/ui/status-text';
import { Space } from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { SEARCH_QUERY } from '@/sanity/queries';
import type { PlaceCardData } from '@/types/content';

export function PlaceSearch({
  onPlacePress,
  placeholder = 'Search TripIdeas Places',
}: {
  onPlacePress?: (place: PlaceCardData) => void;
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

  return <View style={{ gap: Space.md }}>
    <AppTextInput
      accessibilityLabel="Search TripIdeas Places"
      autoCapitalize="none"
      autoCorrect={false}
      onChangeText={setQuery}
      placeholder={placeholder}
      returnKeyType="search"
      value={query}
    />
    {!debouncedQuery ? null : errorMessage ? <StatusText>{errorMessage}</StatusText>
      : isSearching ? <StatusText>Searching...</StatusText>
      : results.length ? results.map((place, index) => <PlaceCard
        key={place._id ?? place.slug?.current ?? index}
        onPress={onPlacePress ? () => onPlacePress(place) : undefined}
        place={place}
      />) : <StatusText>No places found.</StatusText>}
  </View>;
}
