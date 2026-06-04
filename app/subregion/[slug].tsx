import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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

type SubRegion = {
  _id?: string;
  name?: string;
  slug?: Slug;
  places?: PlacePage[];
};

const PAGE_SIZE = 10;

const SUBREGION_QUERY = `
*[_type == "subRegion" && slug.current == $slug][0]{
  _id,
  name,
  slug,
  "places": *[_type == "page" && subRegion._ref == ^._id] | order(title asc){
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

export default function SubRegionScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const [subRegion, setSubRegion] = useState<SubRegion | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSlug) {
      setSubRegion(null);
      setErrorMessage('Missing subregion slug.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);
    setVisibleCount(PAGE_SIZE);

    sanityClient
      .fetch<SubRegion | null>(SUBREGION_QUERY, { slug: selectedSlug })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setSubRegion(data);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error(error);
        setSubRegion(null);
        setErrorMessage('Unable to load this subregion.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);

  const places = (subRegion?.places ?? []).filter(Boolean);
  const visiblePlaces = places.slice(0, visibleCount);
  const hasMorePlaces = visibleCount < places.length;
  const title = subRegion?.name ?? 'Subregion';

  return (
    <ScrollView style={{ flex: 1, padding: 24, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ title }} />

      {isLoading ? (
        <Text>Loading...</Text>
      ) : errorMessage ? (
        <Text>{errorMessage}</Text>
      ) : !subRegion ? (
        <Text>Subregion not found.</Text>
      ) : (
        <>
          <Text style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
            {subRegion.name ?? 'Untitled subregion'}
          </Text>

          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
            Places
          </Text>

          {visiblePlaces.length > 0 ? (
            visiblePlaces.map((place, index) => {
              const heading = getPlaceHeading(place);
              const preview = getPlacePreview(place);

              return (
                <Link
                  key={place._id ?? place.slug?.current ?? index}
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
                        accessibilityLabel={
                          place.imageAlt ?? place.title ?? 'Place image'
                        }
                        style={{ aspectRatio: 16 / 9, width: '100%' }}
                        contentFit="cover"
                      />
                    ) : null}

                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 16,
                      }}>
                      <Text
                        numberOfLines={2}
                        style={{ fontSize: 20, fontWeight: '700' }}>
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
            })
          ) : (
            <Text>No places found.</Text>
          )}

          {hasMorePlaces ? (
            <Pressable
              onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
              style={{
                alignItems: 'center',
                borderColor: '#111',
                borderRadius: 8,
                borderWidth: 1,
                marginTop: 16,
                paddingVertical: 12,
              }}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>
                Load more
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
