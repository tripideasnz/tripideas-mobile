// The Shared With Me view of the Trips feature: live Trips the user has joined, as compact cards.
// It shows saved content with a plain label when the server cannot be reached, and says so when
// there is nothing yet, rather than showing a blank screen.
import { View } from 'react-native';

import { SharedTripIndexCard } from '@/components/shared-trip-index-card';
import { StatusText } from '@/components/ui/status-text';
import { Space } from '@/constants/design';
import type { Resource } from '@/shared-trips/store';
import { emptySharedMessage, freshness, type SharedTripRow } from '@/shared-trips/view-model';
import type { SharedTripSummary } from '@/shared-trips/types';

export function SharedWithMeList({
  onOpen,
  resource,
  rows,
}: {
  onOpen: (collectionId: string) => void;
  resource: Resource<SharedTripSummary[]>;
  rows: SharedTripRow[];
}) {
  const note = freshness(resource);
  return (
    <View>
      {note.message ? <StatusText style={{ marginBottom: Space.lg }}>{note.message}</StatusText> : null}
      {rows.length > 0 ? (
        rows.map((row) => (
          <View key={row.id} style={{ marginBottom: Space.md }}>
            <SharedTripIndexCard onPress={() => onOpen(row.id)} row={row} />
          </View>
        ))
      ) : (
        <StatusText>{emptySharedMessage(resource)}</StatusText>
      )}
    </View>
  );
}
