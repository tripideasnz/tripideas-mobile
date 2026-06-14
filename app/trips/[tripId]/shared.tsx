import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { PlaceCard } from '@/components/place-card';
import { LoadingView } from '@/components/ui/loading-view';
import { TripShareCard } from '@/components/trip-share-card';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { useMyTrips } from '@/trips/provider';
import { buildTripShareCardData } from '@/trips/share';
import type { PlaceCardData } from '@/types/content';

export default function SharedTripPreviewScreen() {
  const { tripId } = useLocalSearchParams<{
    tripId?: string | string[];
  }>();
  const selectedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const router = useRouter();
  const { getTrip, isLoading: isLoadingTrips } = useMyTrips();
  const trip = getTrip(selectedTripId);
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const placeIds = useMemo(
    () => trip?.places.map((place) => place.placeId) ?? [],
    [trip?.places]
  );
  const placeIdsKey = placeIds.join('|');
  const placesById = useMemo(
    () =>
      new Map(
        places
          .filter((place) => place._id)
          .map((place) => [place._id as string, place])
      ),
    [places]
  );
  const shareCardData = trip
    ? buildTripShareCardData({
        places,
        trip,
      })
    : null;

  useEffect(() => {
    if (!trip || placeIds.length === 0) {
      setPlaces([]);
      setErrorMessage(null);
      setIsLoadingPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingPlaces(true);
    setErrorMessage(null);

    fetchPlaceCardsByIds(placeIds)
      .then((data) => {
        if (isMounted) {
          setPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setPlaces([]);
          setErrorMessage('Unable to load places for this trip.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPlaces(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // A stable string prevents refetching when unrelated trip fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeIdsKey, selectedTripId]);

  return (
    <SafeAreaView style={{ backgroundColor: Palette.background, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Space.lg,
        }}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: Space.xxl,
          }}>
          <BrandLogo style={{ height: 42 }} />
          <Pressable
            accessibilityLabel="Close trip preview"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: Palette.surfaceMuted,
              borderRadius: Radius.pill,
              height: 36,
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
              width: 36,
            })}>
            <MaterialIcons color={Palette.text} name="close" size={22} />
          </Pressable>
        </View>

        {isLoadingTrips || isLoadingPlaces ? (
          <LoadingView />
        ) : !trip || !selectedTripId ? (
          <Text style={{ color: Palette.textMuted, ...Type.body }}>
            This shared trip could not be found on this device.
          </Text>
        ) : (
          <>
            <Text
              style={{
                color: Palette.textMuted,
                ...Type.label,
                marginBottom: Space.sm,
                textTransform: 'uppercase',
              }}>
              Read-only trip
            </Text>
            {shareCardData ? <TripShareCard data={shareCardData} /> : null}

            <View style={{ flexDirection: 'row', gap: Space.sm }}>
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL('https://tripideas.nz')}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  backgroundColor: Palette.primary,
                  borderRadius: Radius.control,
                  flex: 1,
                  opacity: pressed ? 0.72 : 1,
                  paddingHorizontal: Space.sm,
                  paddingVertical: Space.md,
                })}>
                <Text
                  style={{
                    color: Palette.textOnPrimary,
                    ...Type.label,
                    textAlign: 'center',
                  }}>
                  Open on TripIdeas.nz
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                disabled
                style={{
                  alignItems: 'center',
                  backgroundColor: Palette.surfaceMuted,
                  borderColor: Palette.border,
                  borderRadius: Radius.control,
                  borderWidth: 1,
                  flex: 1,
                  paddingHorizontal: Space.sm,
                  paddingVertical: Space.md,
                }}>
                <Text
                  style={{
                    color: Palette.textMuted,
                    ...Type.label,
                    textAlign: 'center',
                  }}>
                  Open in app
                </Text>
              </Pressable>
            </View>
            <Text
              style={{
                color: Palette.textMuted,
                ...Type.caption,
                marginBottom: Space.xxxl,
                marginTop: Space.sm,
              }}>
              App opening will be available when shared-trip deep links are
              ready.
            </Text>

            <Text style={{ ...Type.section, marginBottom: Space.lg }}>
              Places
            </Text>

            {errorMessage ? (
              <Text style={{ color: Palette.textMuted, ...Type.body }}>
                {errorMessage}
              </Text>
            ) : trip.places.length === 0 ? (
              <Text style={{ color: Palette.textMuted, ...Type.body }}>
                This trip has no places yet.
              </Text>
            ) : (
              trip.places.map((tripPlace) => {
                const place = placesById.get(tripPlace.placeId);

                if (!place) {
                  return null;
                }

                return (
                  <View key={tripPlace.placeId}>
                    <PlaceCard place={place} showSaveButton={false} />
                    {tripPlace.note.trim() ? (
                      <View
                        style={{
                          backgroundColor: Palette.surfaceMuted,
                          borderRadius: Radius.control,
                          marginBottom: Space.xxl,
                          marginTop: -12,
                          padding: Space.md,
                        }}>
                        <Text
                          style={{ ...Type.label, marginBottom: Space.xs }}>
                          Trip note
                        </Text>
                        <Text
                          style={{ color: Palette.textBody, ...Type.body }}>
                          {tripPlace.note}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
