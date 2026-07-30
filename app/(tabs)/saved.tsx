import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceCard } from '@/components/place-card';
import { TripImageCollage } from '@/components/trip-image-collage';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { StatusText } from '@/components/ui/status-text';
import {
  Palette,
  Radius,
  Screen,
  Space,
  Type,
} from '@/constants/design';
import { useSavedPlaces } from '@/saved/provider';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { getTripImages } from '@/trips/images';
import { openNotebookList } from '@/notebooks/navigation';
import { useMyTrips } from '@/trips/provider';
import type { PlaceCardData } from '@/types/content';

export default function SavedScreen() {
  const router = useRouter();
  const { isLoading: isLoadingSavedIds, savedPlaceIds } = useSavedPlaces();
  const {
    confirmImport,
    createTrip,
    deferImport,
    importDecision,
    importProgress,
    isImporting,
    isLoading: isLoadingTrips,
    loadError: tripLoadError,
    retryImport,
    trips,
  } = useMyTrips();
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [tripPlaces, setTripPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [isLoadingTripPlaces, setIsLoadingTripPlaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newTripName, setNewTripName] = useState('');
  const tripPlaceIds = useMemo(
    () =>
      Array.from(
        new Set(
          trips.flatMap((trip) =>
            trip.places.map((tripPlace) => tripPlace.placeId)
          )
        )
      ),
    [trips]
  );
  const tripPlaceIdsKey = tripPlaceIds.join('|');

  useEffect(() => {
    if (isLoadingSavedIds) {
      return;
    }

    if (savedPlaceIds.length === 0) {
      setPlaces([]);
      setErrorMessage(null);
      setIsLoadingPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingPlaces(true);
    setErrorMessage(null);

    fetchPlaceCardsByIds(savedPlaceIds)
      .then((data) => {
        if (isMounted) {
          setPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setPlaces([]);
          setErrorMessage('Unable to load favourites.');
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
  }, [isLoadingSavedIds, savedPlaceIds]);

  useEffect(() => {
    if (isLoadingTrips || tripPlaceIds.length === 0) {
      setTripPlaces([]);
      setIsLoadingTripPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingTripPlaces(true);

    fetchPlaceCardsByIds(tripPlaceIds)
      .then((data) => {
        if (isMounted) {
          setTripPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setTripPlaces([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingTripPlaces(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // A stable string prevents refetches when trip notes or names change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingTrips, tripPlaceIdsKey]);

  const isLoading = isLoadingSavedIds || isLoadingPlaces;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        <AppText style={{ marginBottom: Space.xl }} variant="display">
          Saved
        </AppText>

        <View style={{ marginBottom: Space.xxxl }}>
          <AppText style={{ marginBottom: Space.md }} variant="section">
            Notebooks
          </AppText>
          <Pressable
            accessibilityLabel="Open your private Notebooks"
            accessibilityRole="button"
            onPress={() => openNotebookList(router)}
            style={({ pressed }) => ({
              backgroundColor: Palette.surfaceMuted,
              borderColor: Palette.border,
              borderRadius: Radius.card,
              borderWidth: 1,
              minHeight: 64,
              opacity: pressed ? 0.65 : 1,
              padding: Space.lg,
            })}>
            <AppText variant="bodyStrong">Your travel Notebooks</AppText>
            <AppText color={Palette.textMuted}>
              Keep private notes and ideas together.
            </AppText>
          </Pressable>
        </View>

        <View style={{ marginBottom: Space.xxxl }}>
          <AppText style={{ marginBottom: Space.md }} variant="section">
            My Trips
          </AppText>

          {importDecision ? (
            <View
              accessibilityLabel="Import Trips confirmation"
              style={{
                backgroundColor: Palette.surfaceMuted,
                borderColor: Palette.border,
                borderRadius: Radius.card,
                borderWidth: 1,
                marginBottom: Space.lg,
                padding: Space.lg,
              }}>
              <AppText variant="bodyStrong">
                Add {importDecision.count}{' '}
                {importDecision.count === 1 ? 'Trip' : 'Trips'} to your account?
              </AppText>
              <AppText color={Palette.textMuted} style={{ marginTop: Space.sm }}>
                These Trips are currently saved only on this device. Import them
                into {importDecision.accountLabel}. Nothing will be removed until
                every Trip is verified.
              </AppText>
              <View
                style={{
                  flexDirection: 'row',
                  gap: Space.sm,
                  marginTop: Space.lg,
                }}>
                <AppButton
                  label="Import Trips"
                  onPress={() => void confirmImport()}
                />
                <AppButton
                  label="Not now"
                  onPress={deferImport}
                  variant="secondary"
                />
              </View>
            </View>
          ) : null}

          {isImporting ? (
            <StatusText>
              Importing Trips… {importProgress.completed} of {importProgress.total}{' '}
              verified.
            </StatusText>
          ) : importProgress.retryableErrors > 0 ? (
            <View style={{ marginBottom: Space.lg }}>
              <StatusText>
                {importProgress.retryableErrors}{' '}
                {importProgress.retryableErrors === 1 ? 'Trip needs' : 'Trips need'}{' '}
                another attempt. Verified Trips will not be recreated.
              </StatusText>
              <AppButton label="Retry import" onPress={() => void retryImport()} />
            </View>
          ) : null}

          {importProgress.permanentErrors > 0 ? (
            <StatusText>
              {importProgress.permanentErrors}{' '}
              {importProgress.permanentErrors === 1 ? 'Trip has' : 'Trips have'}{' '}
              data that could not be imported. Its device copy remains unchanged.
            </StatusText>
          ) : null}

          {tripLoadError ? <StatusText>{tripLoadError}</StatusText> : null}

          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: Space.md,
              marginBottom: Space.lg,
            }}>
            <AppTextInput
              accessibilityLabel="New trip name"
              onChangeText={setNewTripName}
              onSubmitEditing={async () => {
                if (!newTripName.trim()) return;

                const trip = await createTrip(newTripName);

                if (trip) {
                  setNewTripName('');
                }
              }}
              placeholder="Add new trip"
              returnKeyType="done"
              style={{ flex: 1 }}
              value={newTripName}
            />
            <AppButton
              disabled={!newTripName.trim()}
              label="Create"
              onPress={async () => {
                const trip = await createTrip(newTripName);

                if (trip) {
                  setNewTripName('');
                }
              }}
            />
          </View>

          {isLoadingTrips || isLoadingTripPlaces ? (
            <StatusText>Loading trips...</StatusText>
          ) : trips.length > 0 ? (
            trips.map((trip) => {
              const tripImages = getTripImages(trip, tripPlaces).slice(0, 4);

              return (
                <Pressable
                  accessibilityRole="button"
                  key={trip.id}
                  onPress={() =>
                    router.push({
                      pathname: '/trips/[tripId]',
                      params: { tripId: trip.id },
                    })
                  }
                  style={({ pressed }) => ({
                    borderColor: Palette.border,
                    borderRadius: Radius.card,
                    borderWidth: 1,
                    flexDirection: 'row',
                    marginBottom: Space.md,
                    opacity: pressed ? 0.65 : 1,
                    overflow: 'hidden',
                  })}>
                  <TripImageCollage
                    images={tripImages}
                    style={{ height: 92, width: 112 }}
                  />

                  <View
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      padding: Space.lg,
                    }}>
                    <Text
                      numberOfLines={2}
                      style={Type.cardTitle}>
                      {trip.name}
                    </Text>
                    <Text
                      style={{
                        color: Palette.textMuted,
                        ...Type.label,
                        marginTop: Space.xs,
                      }}>
                      {trip.places.length}{' '}
                      {trip.places.length === 1 ? 'place' : 'places'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <StatusText>
              No trips yet. Create one for places you want to group together.
            </StatusText>
          )}
        </View>

        <AppText style={{ marginBottom: Space.md }} variant="section">
          Favourites
        </AppText>

        {isLoading ? (
          <StatusText>Loading favourites...</StatusText>
        ) : errorMessage ? (
          <StatusText>{errorMessage}</StatusText>
        ) : places.length > 0 ? (
          places.map((place, index) => {
            const key = place._id ?? place.slug?.current ?? index;

            return <PlaceCard key={key} place={place} />;
          })
        ) : (
          <StatusText>No favourites yet.</StatusText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
