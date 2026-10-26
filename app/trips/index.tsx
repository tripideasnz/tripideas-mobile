import { Stack, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import { TripIndexCard } from '@/components/trip-index-card';
import { SignedOutFeature } from '@/components/signed-out-feature';
import { useSession } from '@/auth/provider';
import { IconAction } from '@/components/ui/icon-action';
import { headerAddAction } from '@/components/ui/header-actions';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AutoExpandingTextInput } from '@/components/ui/app-text-input';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { getTripImages } from '@/trips/images';
import { tripRequestDiagnostic } from '@/trips/error-diagnostic';
import { useMyTrips } from '@/trips/provider';
import { useTripPlaceCards } from '@/trips/use-trip-place-cards';

export default function TripsScreen() {
  const { isLoading: isLoadingSession, session, signIn } = useSession();
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
  const creatingRef = useRef(false);
  const [newTripName, setNewTripName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const tripPlaceIds = useMemo(
    () => Array.from(new Set(trips.flatMap((trip) => trip.places.map((place) => place.placeId)))),
    [trips]
  );
  const { cards: tripPlaces, isLoadingCards: isLoadingPlaces } = useTripPlaceCards(tripPlaceIds);

  const submitCreate = async () => {
    if (!newTripName.trim() || creatingRef.current) return;
    creatingRef.current = true;
    setIsCreatingTrip(true);
    setCreateError(null);
    try {
      const trip = await createTrip(newTripName);
      if (trip) {
        setNewTripName('');
        setShowCreate(false);
        router.push({ pathname: '/trips/[tripId]', params: { tripId: trip.id } });
      }
    } catch (error) {
      setCreateError(
        `Could not create the Trip${tripRequestDiagnostic(error)}. Check your connection and try again.`
      );
    } finally {
      creatingRef.current = false;
      setIsCreatingTrip(false);
    }
  };

  if (isLoadingSession) return <StatusText>Loading Trips…</StatusText>;
  if (!session) {
    return (
      <SignedOutFeature
        message="Sign in to view and edit your private Trips"
        onSignIn={signIn}
      />
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        paddingBottom: Screen.bottom,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}>
      <Stack.Screen
        options={{
          ...headerAddAction({ accessibilityLabel: 'Add Trip', disabled: showCreate, onPress: () => setShowCreate(true) }),
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
          <AutoExpandingTextInput
            accessibilityLabel="New trip name"
            autoFocus
            editable={!isCreatingTrip}
            onChangeText={(value) => {
              setNewTripName(value);
              setCreateError(null);
            }}
            onSubmitEditing={submitCreate}
            placeholder="Add new trip"
            returnKeyType="done"
            style={{ flex: 1 }}
            value={newTripName}
          />
          {isCreatingTrip ? <View accessibilityLabel="Creating Trip" accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Palette.trip} />
          </View> : <IconAction
            accessibilityLabel="Create Trip"
            color={Palette.success}
            disabled={!newTripName.trim() || isCreatingTrip}
            icon="check"
            onPress={submitCreate}
          />}
          <IconAction
            accessibilityLabel="Cancel Trip creation"
            color={Palette.danger}
            disabled={isCreatingTrip}
            icon="close"
            onPress={() => {
              setNewTripName('');
              setCreateError(null);
              setShowCreate(false);
            }}
          />
        </View>
      ) : null}
      {createError ? <AppText color={Palette.danger} style={{ marginBottom: Space.lg }}>{createError}</AppText> : null}

      {isLoading || (isLoadingPlaces && tripPlaces.length === 0) ? (
        <StatusText>Loading trips...</StatusText>
      ) : trips.length ? (
        trips.map((trip) => {
          const images = getTripImages(trip, tripPlaces).slice(0, 4);
          return (
            <View key={trip.id} style={{ marginBottom: Space.md }}>
              <TripIndexCard
                accessibilityLabel={`Open ${trip.name}`}
                images={images}
                onPress={() => router.push({ pathname: '/trips/[tripId]', params: { tripId: trip.id } })}
                trip={trip}
              />
              <View style={{ position: 'absolute', right: Space.md, top: 28 }}>
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
