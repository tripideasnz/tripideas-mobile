import { useState } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { AddPlaceToTripButton } from '@/components/add-place-to-trip-button';
import { AddToTripModal } from '@/components/add-to-trip-modal';
import { SavePlaceButton } from '@/components/save-place-button';
import { useSavedPlaces } from '@/saved/provider';
import { useMyTrips } from '@/trips/provider';
import { useSession } from '@/auth/provider';

type PlaceCardActionsProps = {
  buttonStyle?: ViewStyle;
  inline?: boolean;
  placeId: string;
  style?: ViewStyle;
};

export function PlaceCardActions({
  buttonStyle,
  inline = false,
  placeId,
  style,
}: PlaceCardActionsProps) {
  const router = useRouter();
  const { isSaved, toggleSavedPlace } = useSavedPlaces();
  const { session, signIn } = useSession();
  const { addPlaceToTrip, createTripWithPlace, trips } = useMyTrips();
  const [isTripPickerOpen, setIsTripPickerOpen] = useState(false);
  const isInTrip = trips.some((trip) =>
    trip.places.some((place) => place.placeId === placeId)
  );

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          {
            flexDirection: 'row',
            gap: inline ? 8 : undefined,
            justifyContent: inline ? undefined : 'space-between',
            left: inline ? undefined : 12,
            position: inline ? 'relative' : 'absolute',
            right: inline ? undefined : 12,
            top: inline ? undefined : 12,
          },
          style,
        ]}>
        <SavePlaceButton
          isSignedIn={Boolean(session)}
          isSaved={isSaved(placeId)}
          onPress={(event) => {
            event.stopPropagation();
            void (async () => {
              if (!session && !(await signIn())) return;
              await toggleSavedPlace(placeId);
            })();
          }}
          style={buttonStyle}
        />
        <AddPlaceToTripButton
          isInTrip={isInTrip}
          isSignedIn={Boolean(session)}
          onPress={(event) => {
            event.stopPropagation();
            void (async () => {
              if (!session && !(await signIn())) return;
              setIsTripPickerOpen(true);
            })();
          }}
          style={buttonStyle}
        />
      </View>

      <AddToTripModal
        onClose={() => setIsTripPickerOpen(false)}
        onCreateTrip={async (name) => {
          return createTripWithPlace(name, placeId);
        }}
        onOpenTrip={(tripId) => {
          setIsTripPickerOpen(false);
          router.push({ pathname: '/trips/[tripId]', params: { tripId } });
        }}
        onSelectTrip={async (tripId) => {
          const selectedTrip = trips.find((trip) => trip.id === tripId);
          const alreadyAdded = selectedTrip?.places.some(
            (place) => place.placeId === placeId
          );

          if (alreadyAdded) {
            return selectedTrip ?? null;
          }

          await addPlaceToTrip(tripId, placeId);
          if (!selectedTrip) return null;
          return {
            ...selectedTrip,
            places: [...selectedTrip.places, {
              addedAt: new Date().toISOString(),
              note: '',
              placeId,
            }],
            updatedAt: new Date().toISOString(),
          };
        }}
        placeId={isTripPickerOpen ? placeId : null}
        trips={trips}
      />
    </>
  );
}
