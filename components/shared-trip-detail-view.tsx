// The joined Shared Trip: the creator's Trip as the server last described it, with everyone's notes.
//
// It draws what it is given and offers only what the server's permissions allow. There are no
// structure controls here (no add, remove, reorder or rename of Places): the creator changes those in
// their own Trip, and participants only read them. Every participant can write one note of their own
// on the Trip and on each Place; other people's notes are read-only and labelled by author.
import { Alert, ScrollView, View } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AutosaveNote } from '@/components/ui/autosave-note';
import { CardSurface } from '@/components/ui/card-surface';
import { IconAction } from '@/components/ui/icon-action';
import { ShowMoreText } from '@/components/ui/show-more-text';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import {
  authorLabel,
  deleteNoteConfirmation,
  detailControls,
  leaveConfirmation,
  membershipStatus,
  ownerLabel,
  splitNotes,
  type Freshness,
} from '@/shared-trips/view-model';
import type { SharedTripNote, SharedTripDetail } from '@/shared-trips/types';
import type { SaveMessage } from '@/trips/shared-trip-messages';
import type { PlaceCardData } from '@/types/content';

type NoteHandlers = {
  /** Resolves when saved; rejects on failure so the editor keeps the text and offers a retry. */
  onDeletePlaceNote: (itemId: string) => Promise<void>;
  onDeleteTripNote: () => Promise<void>;
  onSavePlaceNote: (itemId: string, text: string) => Promise<void>;
  onSaveTripNote: (text: string) => Promise<void>;
};

function OthersNotes({ notes }: { notes: SharedTripNote[] }) {
  if (notes.length === 0) return null;
  return (
    <View style={{ gap: Space.md }}>
      {notes.map((note) => (
        <View
          accessibilityLabel={`Note by ${authorLabel(note)}`}
          accessible
          key={note.id}
          style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.control, gap: Space.xs, padding: Space.md }}>
          <AppText variant="label">{authorLabel(note)}</AppText>
          <ShowMoreText accessibilityLabel={`Note by ${authorLabel(note)}`} value={note.text} />
        </View>
      ))}
    </View>
  );
}

/** The viewer's own note: autosaved like every other Trip note; clearing the text deletes it. */
function OwnNote({
  canWrite,
  label,
  mine,
  onDelete,
  onSave,
  placeholder,
  subject,
}: {
  canWrite: boolean;
  label: string;
  mine: SharedTripNote | null;
  onDelete: () => Promise<void>;
  onSave: (text: string) => Promise<void>;
  placeholder: string;
  subject: string;
}) {
  if (!mine && !canWrite) return null;
  if (mine && !mine.canEdit) {
    return (
      <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.control, padding: Space.md }}>
        <AppText variant="label">You</AppText>
        <ShowMoreText accessibilityLabel={label} value={mine.text} />
      </View>
    );
  }
  const confirmDelete = () => {
    const dialog = deleteNoteConfirmation(subject);
    Alert.alert(dialog.title, dialog.message, [
      { style: 'cancel', text: dialog.cancelLabel },
      { onPress: () => void onDelete().catch(() => undefined), style: 'destructive', text: dialog.confirmLabel },
    ]);
  };
  return (
    <View style={{ gap: Space.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <AppText style={{ flex: 1 }} variant="label">Your note</AppText>
        {mine?.canDelete ? (
          <IconAction
            accessibilityLabel={`Delete your note on ${subject}`}
            destructive
            icon="delete-outline"
            onPress={confirmDelete}
            size="compact"
          />
        ) : null}
      </View>
      <AutosaveNote
        accessibilityLabel={label}
        // Clearing the text removes the note; there is nothing to remove when none exists yet.
        onSave={(text) => (text.trim() ? onSave(text) : mine ? onDelete() : Promise.resolve())}
        placeholder={placeholder}
        value={mine?.text ?? ''}
      />
    </View>
  );
}

export function SharedTripDetailView({
  cardsById,
  cardsPending,
  copyMessage,
  detail,
  freshness,
  handlers,
  isCopying,
  isLeaving,
  membershipMessage,
  onLeave,
  onOpenCopy,
  onSaveCopy,
  refreshControl,
}: {
  cardsById: Map<string, PlaceCardData>;
  cardsPending: boolean;
  copyMessage: SaveMessage | null;
  detail: SharedTripDetail;
  freshness: Freshness;
  handlers: NoteHandlers;
  isCopying: boolean;
  isLeaving: boolean;
  membershipMessage: string | null;
  onLeave: () => void;
  onOpenCopy: (tripId: string) => void;
  onSaveCopy: () => void;
  refreshControl?: React.ReactElement<React.ComponentProps<typeof import('react-native').RefreshControl>>;
}) {
  const controls = detailControls(detail);
  const tripNotes = splitNotes(detail.notes);
  const confirmLeave = () => {
    const dialog = leaveConfirmation(detail.collection.title);
    Alert.alert(dialog.title, dialog.message, [
      { style: 'cancel', text: dialog.cancelLabel },
      { onPress: onLeave, style: 'destructive', text: dialog.confirmLabel },
    ]);
  };
  const placeLabel = `${detail.places.length} ${detail.places.length === 1 ? 'place' : 'places'}`;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: Screen.bottom, paddingHorizontal: Screen.gutter, paddingTop: Screen.top }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      style={{ backgroundColor: Palette.background, flex: 1 }}>
      <AppText accessibilityRole="header" variant="title">{detail.collection.title}</AppText>
      <AppText color={Palette.textMuted} style={{ marginTop: Space.xs }} variant="caption">
        {controls.isCreator ? 'Your Trip' : `By ${ownerLabel(detail.owner)}`} · {placeLabel}
      </AppText>
      <AppText color={Palette.textMuted} style={{ marginTop: Space.xs }} variant="caption">
        {membershipStatus(detail)}
      </AppText>

      {freshness.message ? (
        <View
          accessibilityLabel={freshness.message}
          accessibilityLiveRegion="polite"
          accessible
          style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.control, marginTop: Space.md, padding: Space.md }}>
          <AppText color={Palette.textMuted} variant="caption">{freshness.message}</AppText>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.lg }}>
        {controls.canSaveCopy ? (
          <AppButton
            accessibilityState={{ busy: isCopying, disabled: isCopying }}
            disabled={isCopying}
            label={isCopying ? 'Saving…' : 'Save a Copy'}
            onPress={onSaveCopy}
            size="compact"
            variant="secondary"
          />
        ) : null}
        {controls.canLeave ? (
          <AppButton
            accessibilityState={{ busy: isLeaving, disabled: isLeaving }}
            disabled={isLeaving}
            label={isLeaving ? 'Leaving…' : 'Leave Trip'}
            onPress={confirmLeave}
            size="compact"
            variant="danger"
          />
        ) : null}
      </View>
      {controls.isCreator ? (
        <AppText color={Palette.textMuted} style={{ marginTop: Space.sm }} variant="caption">
          {'You change this Trip\'s Places in My Trips.'}
        </AppText>
      ) : (
        <AppText color={Palette.textMuted} style={{ marginTop: Space.sm }} variant="caption">
          {detail.owner.displayName?.trim() ?? 'The creator'} decides which places are in this Trip. You can add your own notes.
        </AppText>
      )}
      {membershipMessage ? (
        <AppText accessibilityLiveRegion="polite" color={Palette.danger} style={{ marginTop: Space.sm }} variant="caption">
          {membershipMessage}
        </AppText>
      ) : null}
      {copyMessage ? (
        <View accessibilityLiveRegion="polite" style={{ gap: Space.sm, marginTop: Space.sm }}>
          <AppText color={copyMessage.tone === 'danger' ? Palette.danger : Palette.textMuted} variant="caption">
            {copyMessage.text}
          </AppText>
          {copyMessage.openSavedTripId ? (
            <AppButton
              label="Open saved Trip"
              onPress={() => onOpenCopy(copyMessage.openSavedTripId as string)}
              size="compact"
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: Space.md, marginTop: Space.xxl }}>
        <AppText variant="section">Trip notes</AppText>
        <OthersNotes notes={tripNotes.others} />
        <OwnNote
          canWrite={controls.canWriteTripNote}
          label="Your note on this Trip"
          mine={tripNotes.mine}
          onDelete={handlers.onDeleteTripNote}
          onSave={handlers.onSaveTripNote}
          placeholder="Add a note for everyone on this Trip"
          subject="this Trip"
        />
        {tripNotes.others.length === 0 && !tripNotes.mine && !controls.canWriteTripNote ? (
          <AppText color={Palette.textMuted}>No notes yet.</AppText>
        ) : null}
      </View>

      <AppText style={{ marginBottom: Space.lg, marginTop: Space.xxl }} variant="section">Places</AppText>
      {detail.places.length === 0 ? (
        <AppText color={Palette.textMuted}>{"The creator hasn't added any places yet."}</AppText>
      ) : (
        detail.places.map((place) => {
          const card = cardsById.get(place.placeId);
          const title = card?.title ?? 'this place';
          const notes = splitNotes(place.notes);
          return (
            <CardSurface key={place.itemId} style={{ marginBottom: Space.xxl }}>
              {card ? (
                <PlaceCard embedded place={card} showSaveButton={false} />
              ) : (
                <View accessibilityLabel={cardsPending ? 'Loading place' : 'Place unavailable'} accessible style={{ padding: Space.lg }}>
                  <View style={{ aspectRatio: 4 / 3, backgroundColor: Palette.surfaceMuted, marginBottom: Space.md }} />
                  <AppText color={Palette.textMuted} variant="cardTitle">
                    {cardsPending ? 'Loading place…' : 'Place unavailable'}
                  </AppText>
                </View>
              )}
              <View style={{ borderTopColor: Palette.border, borderTopWidth: 1, gap: Space.md, padding: Space.lg }}>
                <OthersNotes notes={notes.others} />
                <OwnNote
                  canWrite={controls.canWritePlaceNotes}
                  label={`Your note for ${title}`}
                  mine={notes.mine}
                  onDelete={() => handlers.onDeletePlaceNote(place.itemId)}
                  onSave={(text) => handlers.onSavePlaceNote(place.itemId, text)}
                  placeholder="Add a note about this place"
                  subject={title}
                />
              </View>
            </CardSurface>
          );
        })
      )}
    </ScrollView>
  );
}
