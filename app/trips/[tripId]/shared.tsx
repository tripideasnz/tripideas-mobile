import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { TripShareCard } from '@/components/trip-share-card';
import {
  fetchTripIdeasBranding,
  type TripIdeasBranding,
} from '@/sanity/branding';
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
  const [branding, setBranding] = useState<TripIdeasBranding>({});
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
        logoAlt: branding.logoAlt,
        logoUrl: branding.logoUrl,
        places,
        trip,
      })
    : null;

  useEffect(() => {
    let isMounted = true;

    fetchTripIdeasBranding()
      .then((data) => {
        if (isMounted) {
          setBranding(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setBranding({});
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{
        paddingBottom: 40,
        paddingHorizontal: 24,
        paddingTop: 20,
      }}>
      <Stack.Screen
        options={{ title: trip?.name ?? 'Shared Trip Preview' }}
      />

      {isLoadingTrips || isLoadingPlaces ? (
        <Text style={{ color: '#717171', fontSize: 16 }}>
          Loading shared trip...
        </Text>
      ) : !trip || !selectedTripId ? (
        <Text style={{ color: '#717171', fontSize: 16 }}>
          This shared trip could not be found on this device.
        </Text>
      ) : (
        <>
          <Text
            style={{
              color: '#717171',
              fontSize: 14,
              fontWeight: '700',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}>
            Read-only preview
          </Text>
          {shareCardData ? <TripShareCard data={shareCardData} /> : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/map',
                  params: { tripId: trip.id },
                })
              }
              style={({ pressed }) => ({
                alignItems: 'center',
                borderColor: '#111',
                borderRadius: 10,
                borderWidth: 1,
                flex: 1,
                opacity: pressed ? 0.55 : 1,
                paddingVertical: 12,
              })}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>
                Show on Map
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              style={{
                alignItems: 'center',
                backgroundColor: '#d8d8d8',
                borderRadius: 10,
                flex: 1,
                paddingVertical: 12,
              }}>
              <Text
                style={{ color: '#717171', fontSize: 16, fontWeight: '700' }}>
                Save to My Trips
              </Text>
            </Pressable>
          </View>
          <Text
            style={{
              color: '#717171',
              fontSize: 13,
              lineHeight: 18,
              marginBottom: 28,
              marginTop: 8,
            }}>
            Saving shared trips will be added when account sync is available.
          </Text>

          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 14 }}>
            Places
          </Text>

          {errorMessage ? (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              {errorMessage}
            </Text>
          ) : trip.places.length === 0 ? (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              This trip has no places yet.
            </Text>
          ) : (
            trip.places.map((tripPlace, index) => {
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
                        backgroundColor: '#f5f5f5',
                        borderRadius: 10,
                        marginBottom: 24,
                        marginTop: -12,
                        padding: 14,
                      }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '700',
                          marginBottom: 5,
                        }}>
                        Trip note
                      </Text>
                      <Text
                        style={{ color: '#333', fontSize: 15, lineHeight: 21 }}>
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
  );
}
