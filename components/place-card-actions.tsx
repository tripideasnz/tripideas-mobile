import { useState } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { AddPlaceToTripButton } from '@/components/add-place-to-trip-button';
import { AddToTripModal } from '@/components/add-to-trip-modal';
import { SavePlaceButton } from '@/components/save-place-button';
import { useSavedPlaces } from '@/saved/provider';
import { useMyTrips } from '@/trips/provider';

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
  const { isSaved, toggleSavedPlace } = useSavedPlaces();
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
          isSaved={isSaved(placeId)}
          onPress={(event) => {
            event.stopPropagation();
            void toggleSavedPlace(placeId);
          }}
          style={buttonStyle}
        />
        <AddPlaceToTripButton
          isInTrip={isInTrip}
          onPress={(event) => {
            event.stopPropagation();
            setIsTripPickerOpen(true);
          }}
          style={buttonStyle}
        />
      </View>

      <AddToTripModal
        onClose={() => setIsTripPickerOpen(false)}
        onCreateTrip={async (name) => {
          return createTripWithPlace(name, placeId);
        }}
        onSelectTrip={async (tripId) => {
          const selectedTrip = trips.find((trip) => trip.id === tripId);
          const alreadyAdded = selectedTrip?.places.some(
            (place) => place.placeId === placeId
          );

          if (alreadyAdded) {
            setIsTripPickerOpen(false);
            return;
          }

          await addPlaceToTrip(tripId, placeId);
          setIsTripPickerOpen(false);
        }}
        placeId={isTripPickerOpen ? placeId : null}
        trips={trips}
      />
    </>
  );
}
