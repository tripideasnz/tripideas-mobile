import { Alert, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { AppButton } from '@/components/ui/app-button';
import { AppTextInput } from '@/components/ui/app-text-input';
import { CardSurface } from '@/components/ui/card-surface';
import { PersonalPlaceCardView } from '@/components/personal-place-card-view';
import { PlaceCard } from '@/components/place-card';
import { Palette, Space, Type } from '@/constants/design';
import type { TripEntry } from '@/personal-place-cards/types';
import type { PlaceCardData } from '@/types/content';

export function TripEntryCard({
  entry,
  editorialPlace,
  onRemove,
  onSaveNote,
}: {
  editorialPlace?: PlaceCardData;
  entry: TripEntry;
  onRemove: () => Promise<void>;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(entry.note ?? '');
  useEffect(() => setNote(entry.note ?? ''), [entry.id, entry.note]);
  const unavailable =
    entry.type === 'personalPlaceCard' && 'unavailable' in entry;
  const title =
    entry.type === 'editorialPlace'
      ? editorialPlace?.title ?? 'Editorial place'
      : unavailable
        ? 'Personal Place unavailable'
        : entry.personalPlaceCard.title ?? 'Personal Place';
  return (
    <CardSurface style={{ marginBottom: Space.xxl }}>
      {entry.type === 'editorialPlace' ? (
        editorialPlace ? <PlaceCard embedded place={editorialPlace} /> : (
          <View style={{ padding: Space.lg }}>
            <Text style={Type.cardTitle}>Editorial place unavailable</Text>
          </View>
        )
      ) : unavailable ? (
        <View style={{ padding: Space.lg }}>
          <Text style={Type.cardTitle}>Personal Place unavailable</Text>
          <Text style={{ color: Palette.textMuted, ...Type.body, marginTop: Space.sm }}>
            This entry remains in its original position but its content cannot be shown.
          </Text>
        </View>
      ) : (
        <PersonalPlaceCardView card={entry.personalPlaceCard} embedded />
      )}
      <View style={{ borderTopColor: Palette.border, borderTopWidth: 1, padding: Space.lg }}>
        <Text style={{ ...Type.label, marginBottom: Space.sm }}>Note for {title}</Text>
        <AppTextInput
          accessibilityLabel={`Note for ${title}`}
          multiline
          onChangeText={setNote}
          placeholder="Add a note about this place"
          value={note}
        />
        <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.sm }}>
          <AppButton
            disabled={note === (entry.note ?? '')}
            label="Save Note"
            onPress={() => void onSaveNote(note)}
            style={{ flex: 1 }}
          />
          <AppButton
            label="Remove from Trip"
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => Alert.alert(
              'Remove from Trip?',
              `Remove "${title}" from this Trip? The underlying place will not be deleted.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => void onRemove() },
              ]
            )}
          />
        </View>
      </View>
    </CardSurface>
  );
}
