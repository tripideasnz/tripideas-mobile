import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { StatusText } from '@/components/ui/status-text';
import { PlaceCard } from '@/components/place-card';
import { Palette, Screen, Space } from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { SEARCH_QUERY } from '@/sanity/queries';
import type { PlaceCardData } from '@/types/content';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<PlaceCardData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setErrorMessage(null);
      setIsSearching(false);
      return;
    }

    let isMounted = true;

    setIsSearching(true);
    setErrorMessage(null);

    sanityClient
      .fetch<PlaceCardData[]>(SEARCH_QUERY, { term: `*${debouncedQuery}*` })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setResults((data ?? []).filter(Boolean));
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setResults([]);
          setErrorMessage('Unable to search places right now.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsSearching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  const hasSearched = debouncedQuery.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        <AppText style={{ marginBottom: Space.sm }} variant="display">
          Search
        </AppText>

        <AppText
          color={Palette.textBody}
          style={{ marginBottom: Space.xl }}>
          Search for places, beaches, walks, towns and regions across New Zealand.
        </AppText>

        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search now"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{ marginBottom: Space.xl }}
        />

        {!hasSearched ? null : errorMessage ? (
          <StatusText>{errorMessage}</StatusText>
        ) : isSearching ? (
          <StatusText>Searching...</StatusText>
        ) : results.length > 0 ? (
          <View>
            {results.map((place, index) => (
              <PlaceCard
                key={place._id ?? place.slug?.current ?? index}
                place={place}
              />
            ))}
          </View>
        ) : (
          <StatusText>No places found.</StatusText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
