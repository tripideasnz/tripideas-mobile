import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sanityClient } from '@/sanity/client';

type Slug = {
  current?: string;
};

type PlacePage = {
  _id?: string;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  h3?: string;
  imageAlt?: string;
  imageUrl?: string;
  preview?: string;
  seoDescription?: string;
  slug?: Slug;
};

const SEARCH_QUERY = `
*[
  _type == "page" &&
  slug.current != null &&
  (
    title match $term ||
    subtitle match $term ||
    body[_type == "block" && style == "h3"].children[].text match $term ||
    tags[]->name match $term ||
    tags[]->title match $term ||
    seo.keywords[] match $term ||
    seo.description match $term ||
    subRegion->name match $term ||
    subRegion->region->name match $term
  )
] | order(title asc)[0...30]{
  _id,
  title,
  subtitle,
  excerpt,
  "h3": body[_type == "block" && style == "h3"][0].children[0].text,
  "imageAlt": mainImage.alt,
  "imageUrl": mainImage.asset->url,
  "preview": body[_type == "block" && style == "normal"][0].children[0].text,
  "seoDescription": seo.description,
  slug
}
`;

function getPlaceHeading(place: PlacePage) {
  return place.subtitle?.trim() || place.h3?.trim();
}

function getPlacePreview(place: PlacePage) {
  const preview = place.excerpt?.trim() || place.preview?.trim();

  if (preview && preview.length > 24) {
    return preview;
  }

  return place.seoDescription?.trim() || preview;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<PlacePage[]>([]);
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
      .fetch<PlacePage[]>(SEARCH_QUERY, { term: `*${debouncedQuery}*` })
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

function PlaceCard({ place }: { place: PlacePage }) {
  const heading = getPlaceHeading(place);
  const preview = getPlacePreview(place);

  return (
    <Link
      href={{
        pathname: '/place/[slug]',
        params: { slug: place.slug?.current ?? '' },
      }}
      asChild>
      <Pressable
        disabled={!place.slug?.current}
        style={{
          backgroundColor: '#fff',
          borderRadius: 14,
          elevation: 2,
          marginBottom: 24,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
        }}>
        {place.imageUrl ? (
          <Image
            source={{ uri: place.imageUrl }}
            accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
            style={{ aspectRatio: 16 / 9, width: '100%' }}
            contentFit="cover"
          />
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
          <Text numberOfLines={2} style={{ fontSize: 20, fontWeight: '700' }}>
            {place.title ?? 'Untitled place'}
          </Text>

          {heading ? (
            <Text
              numberOfLines={1}
              style={{
                color: '#717171',
                fontSize: 14,
                fontWeight: '600',
                marginTop: 6,
              }}>
              {heading}
            </Text>
          ) : null}

          {preview ? (
            <Text
              numberOfLines={3}
              style={{
                color: '#4a4a4a',
                fontSize: 15,
                lineHeight: 21,
                marginTop: 10,
              }}>
              {preview}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
