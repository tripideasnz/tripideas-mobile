// What anyone with a Shared Trip link sees before joining: title, creator, the Places in the
// creator's order, and the two distinct choices. It works signed out; the actions ask to sign in.
//
// Join Trip follows the creator's live Trip. Save a Copy makes a separate Trip of the recipient's own.
// Notes are shared content: everyone's Trip and Place notes are shown with their authors. Nothing here
// changes anything: opening a link is read-only, and each action below is a deliberate tap.
import { ScrollView, View } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { ShowMoreText } from '@/components/ui/show-more-text';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { PREVIEW_ACTIONS, previewAuthorLabel } from '@/shared-trips/view-model';
import type { PreviewNote } from '@/shared-trips/types';
import type { PlaceCardData } from '@/types/content';
import type { SaveMessage } from '@/trips/shared-trip-messages';

export function SharedTripPreviewView({
  account,
  cardsById,
  cardsPending,
  creator,
  isCopying,
  isJoining,
  message,
  onJoin,
  onOpenCopy,
  onSaveCopy,
  placeIds,
  placeNotes = [],
  signInHint,
  title,
  tripNotes = [],
}: {
  /** The signed-in account, so the person knows whose Trips a Join or Save will go to. */
  account?: string | null;
  cardsById: Map<string, PlaceCardData>;
  cardsPending: boolean;
  creator: string;
  isCopying: boolean;
  isJoining: boolean;
  message: SaveMessage | null;
  onJoin: () => void;
  onOpenCopy: (tripId: string) => void;
  onSaveCopy: () => void;
  placeIds: string[];
  /** Everyone's notes on each Place, aligned with `placeIds`. */
  placeNotes?: PreviewNote[][];
  signInHint: string | null;
  title: string;
  /** Everyone's Trip-level notes. */
  tripNotes?: PreviewNote[];
}) {
  const busy = isJoining || isCopying;
  const placeLabel = `${placeIds.length} ${placeIds.length === 1 ? 'place' : 'places'}`;
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: Screen.bottom, paddingHorizontal: Screen.gutter, paddingTop: Screen.top }}
      style={{ backgroundColor: Palette.background, flex: 1 }}>
      <AppText color={Palette.textMuted} style={{ textTransform: 'uppercase' }} variant="label">Shared trip</AppText>
      <AppText accessibilityRole="header" style={{ marginTop: Space.xs }} variant="title">{title}</AppText>
      <AppText color={Palette.textMuted} style={{ marginTop: Space.xs }} variant="caption">
        By {creator} · {placeLabel}
      </AppText>
      {account ? (
        <AppText accessibilityLabel={`Signed in as ${account}`} color={Palette.textMuted} style={{ marginTop: Space.xs }} variant="caption">
          Signed in as {account}
        </AppText>
      ) : null}
      {tripNotes.length > 0 ? (
        <View accessibilityLabel="Trip notes" style={{ gap: Space.sm, marginTop: Space.lg }}>
          <AppText variant="label">Trip notes</AppText>
          <NoteList notes={tripNotes} />
        </View>
      ) : null}

      <View style={{ gap: Space.md, marginTop: Space.xl }}>
        <View style={{ gap: Space.xs }}>
          <AppButton
            accessibilityState={{ busy: isJoining, disabled: busy }}
            disabled={busy}
            label={isJoining ? 'Joining…' : PREVIEW_ACTIONS.join.label}
            onPress={onJoin}
          />
          <AppText color={Palette.textMuted} variant="caption">{PREVIEW_ACTIONS.join.explanation}</AppText>
        </View>
        <View style={{ gap: Space.xs }}>
          <AppButton
            accessibilityState={{ busy: isCopying, disabled: busy }}
            disabled={busy}
            label={isCopying ? 'Saving…' : PREVIEW_ACTIONS.copy.label}
            onPress={onSaveCopy}
            variant="secondary"
          />
          <AppText color={Palette.textMuted} variant="caption">{PREVIEW_ACTIONS.copy.explanation}</AppText>
        </View>
        {signInHint ? <AppText color={Palette.textMuted} variant="caption">{signInHint}</AppText> : null}
        {message ? (
          <View accessibilityLiveRegion="polite" style={{ gap: Space.sm }}>
            <AppText color={message.tone === 'danger' ? Palette.danger : Palette.textMuted} variant="caption">
              {message.text}
            </AppText>
            {message.openSavedTripId ? (
              <AppButton
                label="Open saved Trip"
                onPress={() => onOpenCopy(message.openSavedTripId as string)}
                size="compact"
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: Space.xxl }}>
        {placeIds.length === 0 ? (
          <AppText color={Palette.textMuted}>This trip has no places yet.</AppText>
        ) : (
          placeIds.map((placeId, index) => {
            const card = cardsById.get(placeId);
            return (
              <View key={`${placeId}-${index}`} style={{ marginBottom: Space.xxl }}>
                {card ? (
                  <PlaceCard place={card} showSaveButton={false} />
                ) : (
                  <View
                    accessibilityLabel={cardsPending ? 'Loading place' : 'Place unavailable'}
                    accessible
                    style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, padding: Space.md }}>
                    <AppText color={Palette.textMuted} variant="cardTitle">
                      {cardsPending ? 'Loading place…' : 'Place unavailable'}
                    </AppText>
                  </View>
                )}
                {placeNotes[index]?.length ? (
                  <View style={{ marginTop: Space.sm }}>
                    <NoteList notes={placeNotes[index]} />
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

/** Read-only notes with their authors: shared content, the creator's first. */
function NoteList({ notes }: { notes: PreviewNote[] }) {
  return (
    <View style={{ gap: Space.sm }}>
      {notes.map((note, index) => (
        <View
          accessibilityLabel={`Note by ${previewAuthorLabel(note)}`}
          accessible
          key={`${note.author.isCollectionOwner}-${index}`}
          style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.control, gap: Space.xs, padding: Space.md }}>
          <AppText variant="label">{previewAuthorLabel(note)}</AppText>
          <ShowMoreText accessibilityLabel={`Note by ${previewAuthorLabel(note)}`} value={note.text} />
        </View>
      ))}
    </View>
  );
}
