import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Alert, Text, View } from 'react-native';

import { PersonalPlaceCardView } from '@/components/personal-place-card-view';
import { PlaceCard } from '@/components/place-card';
import { AutosaveNote } from '@/components/ui/autosave-note';
import { CardSurface } from '@/components/ui/card-surface';
import { IconAction } from '@/components/ui/icon-action';
import { Palette, Radius, Space, Type } from '@/constants/design';
import type { TripEntry } from '@/personal-place-cards/types';
import type { PlaceCardData } from '@/types/content';

export function TripEntryCard({
  canMoveDown,
  canMoveUp,
  entry,
  editorialPlace,
  highlighted,
  onNavigateDown,
  onNavigateUp,
  onRemove,
  onSaveNote,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  editorialPlace?: PlaceCardData;
  entry: TripEntry;
  highlighted: boolean;
  onNavigateDown: () => void;
  onNavigateUp: () => void;
  onRemove: () => Promise<void>;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const unavailable = entry.type === 'personalPlaceCard' && 'unavailable' in entry;
  const title = entry.type === 'editorialPlace'
    ? editorialPlace?.title ?? 'Editorial place'
    : unavailable
      ? 'Personal Place unavailable'
      : entry.personalPlaceCard.title ?? 'Personal Place';

  const confirmRemove = () => Alert.alert(
    'Delete from Trip Idea?',
    `Remove "${title}" from this Trip? The underlying place will not be deleted.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void onRemove() },
    ]
  );

  return (
    <CardSurface style={{
      borderColor: highlighted ? Palette.trip : Palette.border,
      borderWidth: highlighted ? 2 : 1,
      marginBottom: Space.xxl,
      overflow: 'hidden',
    }}>
      <View>
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
          <>
            <PersonalPlaceCardView card={entry.personalPlaceCard} embedded />
            <View
              accessibilityLabel="Personal Place"
              accessible
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.94)',
                borderRadius: Radius.pill,
                height: 36,
                justifyContent: 'center',
                left: Space.md,
                position: 'absolute',
                top: Space.md,
                width: 36,
              }}>
              <MaterialIcons color={Palette.text} name="location-on" size={22} />
            </View>
          </>
        )}
      </View>

      <View style={{ borderTopColor: Palette.border, borderTopWidth: 1, padding: Space.lg }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: Space.md }}>
          <View style={{ flexDirection: 'row', gap: Space.sm }}>
            <IconAction accessibilityLabel={`Go to previous place before ${title}`} disabled={!canMoveUp} icon="arrow-upward" onPress={onNavigateUp} />
            <IconAction accessibilityLabel={`Go to next place after ${title}`} disabled={!canMoveDown} icon="arrow-downward" onPress={onNavigateDown} />
          </View>
          <View style={{ flex: 1 }} />
          <IconAction
            accessibilityLabel={`Remove ${title} from Trip`}
            destructive
            icon="delete-outline"
            onPress={confirmRemove}
            size="compact"
          />
        </View>
        <Text style={{ ...Type.cardTitle, marginBottom: Space.sm }}>Personal Notes</Text>
        <AutosaveNote
          accessibilityLabel={`note for ${title}`}
          onSave={onSaveNote}
          placeholder="Add a note about this place"
          value={entry.note ?? ''}
        />
      </View>
    </CardSurface>
  );
}
