import { Image } from 'expo-image';
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
import { PlacePhotoGrid } from '@/components/place-photo-grid';
import { PlaceMapPreview } from '@/components/place-map-preview';
import { PlaceCard } from '@/components/place-card';
import { AppButton } from '@/components/ui/app-button';
import {
  Palette,
  Screen,
  Space,
  Type,
} from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { PLACE_QUERY } from '@/sanity/queries';
import type { PlacePage } from '@/sanity/types';

const EXCERPT_LENGTH = 160;

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = cut.lastIndexOf(' ');
  return boundary > 0 ? cut.slice(0, boundary) : cut;
}

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
  const [isExpanded, setIsExpanded] = useState(false);
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
    setIsExpanded(false);

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
  const hasBodyBlocks = (place?.textBlocks ?? []).some((block) => getBlockText(block));
  const excerpt = displayText ? truncateAtWord(displayText, EXCERPT_LENGTH) : undefined;
  const canExpand = Boolean(
    displayText && (displayText.length > EXCERPT_LENGTH || hasBodyBlocks)
  );
  const galleryImages =
    place?.galleryCollections?.flatMap(
      (collection) => collection.images ?? []
    ) ?? [];
  const placeId = place?._id;
  const coordinates = getCoordinates(place);
  const nearbyPlaces = (place?.nearbyPlaces ?? []).filter(Boolean).slice(0, 4);
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
        <>
          {place.imageUrl ? (
            <Image
              source={{ uri: place.imageUrl }}
              accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
              style={{ aspectRatio: 16 / 9, width: '100%' }}
              contentFit="cover"
            />
          ) : null}

          <View
            style={{
              paddingBottom: Space.huge,
              paddingHorizontal: Screen.gutter,
              paddingTop: Screen.top,
            }}>
            <View
              style={{
                alignItems: 'flex-start',
                flexDirection: 'row',
                gap: 12,
                justifyContent: 'space-between',
                marginBottom: Space.xl,
              }}>
              <Text
                style={{
                  flex: 1,
                  ...Type.title,
                }}>
                {place.title}
              </Text>

              {placeId ? (
                <PlaceCardActions
                  buttonStyle={{
                    borderColor: Palette.text,
                    borderWidth: 1,
                  }}
                  inline
                  placeId={placeId}
                />
              ) : null}
            </View>

            <PlacePhotoGrid
              images={galleryImages}
              placeTitle={place.title}
            />

            {(displayText || hasBodyBlocks) ? (
              <View style={{ marginBottom: Space.xl }}>
                {isExpanded ? (
                  <>
                    {hasBodyBlocks ? (
                      <ContentBlocks blocks={place.textBlocks} />
                    ) : displayText ? (
                      <Text style={{ color: Palette.textBody, ...Type.body }}>
                        {displayText}
                      </Text>
                    ) : null}
                    {canExpand ? (
                      <Text
                        onPress={() => setIsExpanded(false)}
                        style={{ color: Palette.textBody, ...Type.bodyStrong, marginTop: Space.md }}>
                        Show less
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={{ color: Palette.textBody, ...Type.body }}>
                    {canExpand ? excerpt : displayText}
                    {canExpand ? (
                      <Text
                        onPress={() => setIsExpanded(true)}
                        style={{ fontStyle: 'italic' }}>
                        {'… read more'}
                      </Text>
                    ) : null}
                  </Text>
                )}
              </View>
            ) : null}

            {coordinates ? (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    ...Type.section,
                    marginBottom: Space.md,
                  }}>
                  Location
                </Text>
                <PlaceMapPreview
                  latitude={coordinates.latitude}
                  longitude={coordinates.longitude}
                  title={place.title}
                />
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
              </View>
            ) : null}

            {nearbyPlaces.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    ...Type.section,
                    marginBottom: Space.md,
                  }}>
                  {place.subRegion?.name ? `More in ${place.subRegion.name}` : 'Nearby Places'}
                </Text>

                {nearbyPlaces.map((nearbyPlace, index) => (
                  <PlaceCard
                    key={nearbyPlace._id ?? nearbyPlace.slug?.current ?? index}
                    place={nearbyPlace}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
