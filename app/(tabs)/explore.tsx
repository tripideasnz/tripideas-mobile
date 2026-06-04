import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceCard, type PlaceCardData } from '@/components/place-card';
import { sanityClient } from '@/sanity/client';
import { SEARCH_QUERY } from '@/sanity/queries';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: 32,
          paddingHorizontal: 24,
          paddingTop: 20,
        }}>
        <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 8 }}>
          Search
        </Text>

        <Text style={{ color: '#4a4a4a', fontSize: 16, marginBottom: 18 }}>
          Find places by name, tags, region, or keywords.
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search places, beaches, walks, regions..."
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            borderColor: '#d8d8d8',
            borderRadius: 12,
            borderWidth: 1,
            fontSize: 17,
            marginBottom: 20,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        />

        {!hasSearched ? (
          <Text style={{ color: '#717171', fontSize: 16 }}>
            Search places, beaches, walks, regions...
          </Text>
        ) : errorMessage ? (
          <Text style={{ color: '#717171', fontSize: 16 }}>{errorMessage}</Text>
        ) : isSearching ? (
          <Text style={{ color: '#717171', fontSize: 16 }}>Searching...</Text>
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
          <Text style={{ color: '#717171', fontSize: 16 }}>No places found.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
