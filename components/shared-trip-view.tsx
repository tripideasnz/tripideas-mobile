// Read-only view of a shared Trip snapshot (B2): title, Trip note, then Places in their
// original order, each with its note, and the Save to My Trips action.
import { ScrollView, View } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { ShowMoreText } from '@/components/ui/show-more-text';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import type { SaveMessage } from '@/trips/shared-trip-messages';
import type { SharedTrip } from '@/trips/shared-trip';
import type { PlaceCardData } from '@/types/content';

export function SharedTripView({
  isSaving,
  message,
  onOpenSavedTrip,
  onSave,
  placeCards,
  trip,
}: {
  isSaving: boolean;
  message: SaveMessage | null;
  onOpenSavedTrip: (tripId: string) => void;
  onSave: () => void;
  placeCards: PlaceCardData[];
  trip: SharedTrip;
}) {
  const cardsById = new Map(
    placeCards.filter((card) => card._id).map((card) => [card._id as string, card])
  );
  const placeLabel = `${trip.places.length} ${trip.places.length === 1 ? 'place' : 'places'}`;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: Screen.bottom,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}
      style={{ backgroundColor: Palette.background, flex: 1 }}>
      <AppText color={Palette.textMuted} variant="label" style={{ textTransform: 'uppercase' }}>
        Shared trip
      </AppText>
      <AppText accessibilityRole="header" style={{ marginTop: Space.xs }} variant="title">
        {trip.title}
      </AppText>
      <AppText color={Palette.textMuted} style={{ marginTop: Space.xs }} variant="caption">
        {placeLabel}
      </AppText>
      {trip.note.trim() ? (
        <View style={{ marginTop: Space.lg }}>
          <ShowMoreText accessibilityLabel="Trip note" value={trip.note} />
        </View>
      ) : null}

      <View style={{ gap: Space.sm, marginBottom: Space.xxl, marginTop: Space.xl }}>
        <AppButton
          accessibilityLabel="Save to My Trips"
          accessibilityState={{ busy: isSaving, disabled: isSaving }}
          disabled={isSaving}
          label={isSaving ? 'Saving…' : 'Save to My Trips'}
          onPress={onSave}
        />
        {message ? (
          <View accessibilityLiveRegion="polite" style={{ gap: Space.sm }}>
            <AppText
              color={message.tone === 'danger' ? Palette.danger : Palette.textMuted}
              variant="caption">
              {message.text}
            </AppText>
            {message.openSavedTripId ? (
              <AppButton
                label="Open saved Trip"
                onPress={() => onOpenSavedTrip(message.openSavedTripId as string)}
                size="compact"
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}
      </View>

      {trip.places.length === 0 ? (
        <AppText color={Palette.textMuted}>This trip has no places yet.</AppText>
      ) : (
        trip.places.map((place, index) => {
          const card = cardsById.get(place.placeId);
          return (
            <View key={`${place.placeId}-${index}`} style={{ marginBottom: Space.xxl }}>
              {card ? (
                <PlaceCard place={card} showSaveButton={false} />
              ) : (
                <View
                  style={{
                    backgroundColor: Palette.surfaceMuted,
                    borderRadius: Radius.card,
                    padding: Space.md,
                  }}>
                  <AppText variant="cardTitle">{place.title || 'Place'}</AppText>
                  {place.subtitle ? (
                    <AppText color={Palette.textMuted} variant="caption">
                      {place.subtitle}
                    </AppText>
                  ) : null}
                </View>
              )}
              {place.note.trim() ? (
                <View
                  style={{
                    backgroundColor: Palette.surfaceMuted,
                    borderRadius: Radius.control,
                    marginTop: Space.sm,
                    padding: Space.md,
                  }}>
                  <AppText style={{ marginBottom: Space.xs }} variant="label">
                    Note
                  </AppText>
                  <AppText color={Palette.textBody}>{place.note}</AppText>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
