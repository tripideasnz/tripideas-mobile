import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  ContentBlocks,
  getBlockText,
  getPlainText,
} from '@/components/content-blocks';
import { PlaceCardActions } from '@/components/place-card-actions';
import { PlaceCard } from '@/components/place-card';
import { PlaceDetailContent } from '@/components/place-detail-content';
import { AppButton } from '@/components/ui/app-button';
import { ShowMoreText } from '@/components/ui/show-more-text';
import { Palette, Space, Type } from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { PLACE_QUERY } from '@/sanity/queries';
import type { PlacePage } from '@/sanity/types';

function getPlacePreview(place: PlacePage) {
  const preview = place.excerpt?.trim() || place.preview?.trim();

  if (preview && preview.length > 24) {
    return preview;
  }

  return place.seoDescription?.trim() || preview;
}

function getBodyText(place: PlacePage) {
  return getPlainText(place.textBlocks);
}

function getCoordinates(place: PlacePage | null) {
  const lat = place?.coordinates?.lat;
  const lng = place?.coordinates?.lng;

  if (typeof lat === 'number' && typeof lng === 'number') {
    return { latitude: lat, longitude: lng };
  }

  return null;
}

export default function PlaceScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const router = useRouter();
  const [place, setPlace] = useState<PlacePage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapMessage, setMapMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSlug) {
      setPlace(null);
      setErrorMessage('Missing place slug.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);
    setMapMessage(null);

    sanityClient
      .fetch<PlacePage | null>(PLACE_QUERY, { slug: selectedSlug })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setPlace(data);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error(error);
        setPlace(null);
        setErrorMessage('Unable to load this place.');
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

  const title = place?.title ?? 'Place';
  const fullText = place ? getBodyText(place) : undefined;
  const preview = place ? getPlacePreview(place) : undefined;
  const displayText = preview || fullText;
  const collapsedText = fullText || displayText;
  const hasBodyBlocks = (place?.textBlocks ?? []).some((block) => getBlockText(block));
  const galleryImages =
    place?.galleryCollections?.flatMap(
      (collection) => collection.images ?? []
    ) ?? [];
  const placeId = place?._id;
  const coordinates = getCoordinates(place);
  const nearbyPlaces = (place?.nearbyPlaces ?? []).filter(Boolean);
  const openTripIdeasMap = () => {
    if (!coordinates) {
      return;
    }

    router.navigate({
      pathname: '/map',
      params: {
        lat: String(coordinates.latitude),
        lng: String(coordinates.longitude),
        title,
        slug: selectedSlug ?? '',
      },
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Palette.background }}>
      <Stack.Screen options={{ title }} />

      {isLoading ? (
        <Text style={{ padding: 24 }}>Loading...</Text>
      ) : errorMessage ? (
        <Text style={{ padding: 24 }}>{errorMessage}</Text>
      ) : !place ? (
        <Text style={{ padding: 24 }}>Place not found.</Text>
      ) : (
        <PlaceDetailContent
          body={(collapsedText || hasBodyBlocks) ? (
            <ShowMoreText
              accessibilityLabel={`${title} description`}
              expandedContent={hasBodyBlocks ? <ContentBlocks blocks={place.textBlocks} /> : undefined}
              forceExpandable={hasBodyBlocks}
              value={collapsedText ?? ''}
            />
          ) : undefined}
          galleryImages={galleryImages}
          hero={place.imageUrl ? {
            alt: place.imageAlt ?? place.title ?? 'Place image',
            url: place.imageUrl,
          } : null}
          location={coordinates}
          mapActions={coordinates ? (
            <>
                <AppButton
                  label="Show on Google Maps"
                  onPress={async () => {
                    const query = encodeURIComponent(
                      `${coordinates.latitude},${coordinates.longitude}`
                    );

                    try {
                      await Linking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${query}`
                      );
                    } catch (error) {
                      console.error(error);
                      setMapMessage('Unable to open maps right now.');
                    }
                  }}
                  style={{ marginTop: Space.md }}
                />

                <AppButton
                  accessibilityRole="button"
                  label="Show on TripIdeas.nz Map"
                  onPress={openTripIdeasMap}
                  style={{ marginTop: Space.md }}
                  variant="secondary"
                />

                {mapMessage ? (
                  <Text
                    style={{
                      color: '#717171',
                      fontSize: 14,
                      marginTop: 10,
                    }}>
                    {mapMessage}
                  </Text>
                ) : null}
            </>
          ) : undefined}
          title={title}
          titleActions={placeId ? (
            <PlaceCardActions
              buttonStyle={{
                borderColor: Palette.text,
                borderWidth: 1,
              }}
              inline
              placeId={placeId}
            />
          ) : undefined}>
            {nearbyPlaces.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    ...Type.section,
                    marginBottom: Space.md,
                  }}>
                  Nearby Places
                </Text>

                {nearbyPlaces.map((nearbyPlace, index) => (
                  <PlaceCard
                    key={nearbyPlace._id ?? nearbyPlace.slug?.current ?? index}
                    place={nearbyPlace}
                  />
                ))}
              </View>
            ) : null}
        </PlaceDetailContent>
      )}
    </ScrollView>
  );
}
