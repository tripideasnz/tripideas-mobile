import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  ContentBlocks,
  getBlockText,
  getPlainText,
} from '@/components/content-blocks';
import { PlaceMapPreview } from '@/components/place-map-preview';
import { PlaceCard } from '@/components/place-card';
import { SavePlaceButton } from '@/components/save-place-button';
import { useSavedPlaces } from '@/saved/provider';
import { sanityClient } from '@/sanity/client';
import { PLACE_QUERY } from '@/sanity/queries';
import type { PlacePage } from '@/sanity/types';

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

function getBodyText(place: PlacePage) {
  return getPlainText(place.textBlocks);
}

function getContextText(place: PlacePage) {
  const regionName = place.subRegion?.region?.name?.trim();
  const subRegionName = place.subRegion?.name?.trim();

  if (regionName && subRegionName) {
    return `${regionName} / ${subRegionName}`;
  }

  return regionName || subRegionName;
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
  const { isSaved, toggleSavedPlace } = useSavedPlaces();
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
  const heading = place ? getPlaceHeading(place) : undefined;
  const fullText = place ? getBodyText(place) : undefined;
  const preview = place ? getPlacePreview(place) : undefined;
  const displayText = preview || fullText;
  const hasBodyBlocks = (place?.textBlocks ?? []).some((block) => getBlockText(block));
  const canExpand = Boolean(fullText && preview && fullText !== preview);
  const contextText = place ? getContextText(place) : undefined;
  const placeId = place?._id;
  const canSavePlace = Boolean(placeId);
  const placeIsSaved = isSaved(placeId);
  const coordinates = getCoordinates(place);
  const nearbyPlaces = (place?.nearbyPlaces ?? []).filter(Boolean).slice(0, 4);
  const openTripIdeasMap = () => {
    if (!coordinates) {
      return;
    }

    router.push({
      pathname: '/map',
      params: {
        lat: String(coordinates.latitude),
        lng: String(coordinates.longitude),
        title,
      },
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
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

          <View style={{ padding: 24 }}>
            {contextText ? (
              <Text
                style={{
                  color: '#717171',
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 10,
                }}>
                {contextText}
              </Text>
            ) : null}

            <View
              style={{
                alignItems: 'flex-start',
                flexDirection: 'row',
                gap: 12,
                justifyContent: 'space-between',
                marginBottom: 8,
              }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 34,
                  fontWeight: '700',
                }}>
                {place.title ?? 'Untitled place'}
              </Text>

              {canSavePlace ? (
                <SavePlaceButton
                  isSaved={placeIsSaved}
                  onPress={() => {
                    void toggleSavedPlace(placeId);
                  }}
                  style={{
                    borderColor: '#111',
                    borderWidth: 1,
                  }}
                />
              ) : null}
            </View>

            {heading ? (
              <Text
                style={{
                  color: '#717171',
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 18,
                }}>
                {heading}
              </Text>
            ) : null}

            {isExpanded && hasBodyBlocks ? (
              <View style={{ marginBottom: 8 }}>
                <ContentBlocks blocks={place.textBlocks} />
              </View>
            ) : displayText ? (
              <Text
                style={{
                  color: '#333',
                  fontSize: 17,
                  lineHeight: 25,
                  marginBottom: 24,
                }}>
                {displayText}
              </Text>
            ) : null}

            {canExpand ? (
              <Pressable
                onPress={() => setIsExpanded((expanded) => !expanded)}
                style={{
                  alignSelf: 'flex-start',
                  marginBottom: 24,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>
                  {isExpanded ? 'Show less' : 'Read more'}
                </Text>
              </Pressable>
            ) : null}

            {coordinates ? (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    marginBottom: 12,
                  }}>
                  Location
                </Text>
                <PlaceMapPreview
                  latitude={coordinates.latitude}
                  longitude={coordinates.longitude}
                  onPress={openTripIdeasMap}
                  title={place.title ?? 'Selected place'}
                />
                <Pressable
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
                  style={{
                    alignItems: 'center',
                    backgroundColor: '#111',
                    borderRadius: 10,
                    marginTop: 12,
                    paddingVertical: 14,
                  }}>
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '700',
                    }}>
                    Show on Google Maps
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={openTripIdeasMap}
                  style={{
                    alignItems: 'center',
                    borderColor: '#d8d8d8',
                    borderRadius: 10,
                    borderWidth: 1,
                    marginTop: 10,
                    paddingVertical: 14,
                  }}>
                  <Text
                    style={{
                      color: '#717171',
                      fontSize: 16,
                      fontWeight: '700',
                    }}>
                    Show on TripIdeas Map
                  </Text>
                </Pressable>

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

            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  marginBottom: 12,
                }}>
                Nearby Places
              </Text>

              {nearbyPlaces.length > 0 ? (
                nearbyPlaces.map((nearbyPlace, index) => (
                  <PlaceCard
                    key={nearbyPlace._id ?? nearbyPlace.slug?.current ?? index}
                    place={nearbyPlace}
                  />
                ))
              ) : (
                <Text style={{ color: '#717171', fontSize: 16 }}>
                  No nearby places found yet.
                </Text>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
