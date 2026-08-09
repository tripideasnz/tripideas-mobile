import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { TripImageCollage } from '@/components/trip-image-collage';
import { IconAction } from '@/components/ui/icon-action';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { getTripImages } from '@/trips/images';
import { useMyTrips } from '@/trips/provider';
import type { PlaceCardData } from '@/types/content';

export default function TripsScreen() {
  const router = useRouter();
  const {
    confirmImport,
    createTrip,
    deferImport,
    deleteTrip,
    importDecision,
    importProgress,
    isImporting,
    isLoading,
    loadError,
    retryImport,
    trips,
  } = useMyTrips();
  const [newTripName, setNewTripName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [tripPlaces, setTripPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const tripPlaceIds = useMemo(
    () => Array.from(new Set(trips.flatMap((trip) => trip.places.map((place) => place.placeId)))),
    [trips]
  );
  const tripPlaceIdsKey = tripPlaceIds.join('|');

  useEffect(() => {
    if (isLoading || tripPlaceIds.length === 0) {
      setTripPlaces([]);
      setIsLoadingPlaces(false);
      return;
    }
    let isMounted = true;
    setIsLoadingPlaces(true);
    fetchPlaceCardsByIds(tripPlaceIds)
      .then((data) => {
        if (isMounted) setTripPlaces(data);
      })
      .catch((error) => {
        console.error(error);
        if (isMounted) setTripPlaces([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPlaces(false);
      });
    return () => {
      isMounted = false;
    };
    // Trip names and notes do not require place-card refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, tripPlaceIdsKey]);

  const submitCreate = async () => {
    if (!newTripName.trim()) return;
    const trip = await createTrip(newTripName);
    if (trip) {
      setNewTripName('');
      setShowCreate(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        paddingBottom: Screen.bottom,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel="Add Trip"
              accessibilityRole="button"
              disabled={showCreate}
              hitSlop={12}
              onPress={() => setShowCreate(true)}
              style={({ pressed }) => ({ opacity: showCreate ? 0.35 : pressed ? 0.55 : 1 })}>
              <MaterialIcons color={Palette.trip} name="add" size={30} />
            </Pressable>
          ),
        }}
      />
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
            Add {importDecision.count} {importDecision.count === 1 ? 'Trip' : 'Trips'} to your account?
          </AppText>
          <AppText color={Palette.textMuted} style={{ marginTop: Space.sm }}>
            These Trips are currently saved only on this device. Import them into{' '}
            {importDecision.accountLabel}. Nothing will be removed until every Trip is verified.
          </AppText>
          <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.lg }}>
            <AppButton label="Import Trips" onPress={() => void confirmImport()} />
            <AppButton label="Not now" onPress={deferImport} variant="secondary" />
          </View>
        </View>
      ) : null}

      {isImporting ? (
        <StatusText>Importing Trips… {importProgress.completed} of {importProgress.total} verified.</StatusText>
      ) : importProgress.retryableErrors > 0 ? (
        <View style={{ marginBottom: Space.lg }}>
          <StatusText>
            {importProgress.retryableErrors} {importProgress.retryableErrors === 1 ? 'Trip needs' : 'Trips need'} another attempt.
          </StatusText>
          <AppButton label="Retry import" onPress={() => void retryImport()} />
        </View>
      ) : null}
      {importProgress.permanentErrors > 0 ? (
        <StatusText>
          {importProgress.permanentErrors} {importProgress.permanentErrors === 1 ? 'Trip has' : 'Trips have'} data that could not be imported. Its device copy remains unchanged.
        </StatusText>
      ) : null}
      {loadError ? <StatusText>{loadError}</StatusText> : null}

      {showCreate ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.md, marginBottom: Space.lg }}>
          <AppTextInput
            accessibilityLabel="New trip name"
            autoFocus
            onChangeText={setNewTripName}
            onSubmitEditing={submitCreate}
            placeholder="Add new trip"
            returnKeyType="done"
            style={{ flex: 1 }}
            value={newTripName}
          />
          <IconAction
            accessibilityLabel="Create Trip"
            disabled={!newTripName.trim()}
            icon="check"
            onPress={submitCreate}
          />
          <IconAction
            accessibilityLabel="Cancel Trip creation"
            icon="close"
            onPress={() => {
              setNewTripName('');
              setShowCreate(false);
            }}
          />
        </View>
      ) : null}

      {isLoading || isLoadingPlaces ? (
        <StatusText>Loading trips...</StatusText>
      ) : trips.length ? (
        trips.map((trip) => {
          const images = getTripImages(trip, tripPlaces).slice(0, 4);
          const placeCount = trip.entries?.length ?? trip.places.length;
          return (
            <View key={trip.id} style={{ marginBottom: Space.md }}>
              <Pressable
                accessibilityLabel={`Open ${trip.name}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/trips/[tripId]', params: { tripId: trip.id } })}
                style={({ pressed }) => ({
                  borderColor: Palette.border,
                  borderRadius: Radius.card,
                  borderWidth: 1,
                  flexDirection: 'row',
                  opacity: pressed ? 0.65 : 1,
                  overflow: 'hidden',
                })}>
                <TripImageCollage images={images} style={{ height: 92, width: 112 }} />
                <View style={{ flex: 1, justifyContent: 'center', padding: Space.lg, paddingRight: 68 }}>
                  <Text numberOfLines={2} style={Type.cardTitle}>{trip.name}</Text>
                  <Text style={{ color: Palette.textMuted, ...Type.label, marginTop: Space.xs }}>
                    {placeCount} {placeCount === 1 ? 'place' : 'places'}
                  </Text>
                </View>
              </Pressable>
              <View style={{ position: 'absolute', right: Space.md, top: 24 }}>
                <IconAction
                  accessibilityLabel={`Delete ${trip.name}`}
                  destructive
                  icon="delete-outline"
                  onPress={() => Alert.alert(
                    'Delete trip?',
                    `This will delete "${trip.name}" and its notes.`,
                    [
                      { style: 'cancel', text: 'Cancel' },
                      { onPress: () => void deleteTrip(trip.id), style: 'destructive', text: 'Delete' },
                    ]
                  )}
                />
              </View>
            </View>
          );
        })
      ) : (
        <StatusText>No trips yet. Create one for places you want to group together.</StatusText>
      )}
    </ScrollView>
  );
}
