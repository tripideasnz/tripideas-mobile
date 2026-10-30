// The two choices on a Shared Trip preview, as a controller the screen wires to its buttons:
//
//  Join Trip    - joins the creator's live Trip (membership only; no copy is made).
//  Save a Copy  - a separate Trip owned by the recipient, through the existing Save workflow.
//
// Rules: one action at a time (a second tap while one runs is ignored); a signed-out tap opens
// sign-in and, once the session arrives, continues that same action; Save a Copy never proceeds
// without the creator's content; failures leave the person where they were with a message.
import type { ActionResult } from '@/shared-trips/store';
import { saveCopyFromSnapshot, toPreviewSnapshot } from '@/shared-trips/copy';
import { membershipErrorMessage } from '@/shared-trips/view-model';
import type { CollectionPreview } from '@/shared-trips/types';
import {
  describeSaveFeedback,
  type SaveFeedback,
  type SaveMessage,
} from '@/trips/shared-trip-messages';
import type { SharedTrip } from '@/trips/shared-trip';
import type { SaveDependencies } from '@/trips/shared-trip-save';

export type PreviewActionsState = {
  busy: 'copy' | 'join' | null;
  message: SaveMessage | null;
};

export type PreviewActionsDeps = {
  collectionId: string;
  copyDependencies: SaveDependencies;
  getPreview: () => CollectionPreview | null;
  getUserId: () => string | null;
  /** Joins the live Trip (the store's join). */
  join: (collectionId: string) => Promise<ActionResult<unknown>>;
  onChange: (state: PreviewActionsState) => void;
  onJoined: () => void;
  onSaved: (tripId: string) => void;
  signIn: () => Promise<boolean>;
};

export function createPreviewActions(deps: PreviewActionsDeps) {
  let state: PreviewActionsState = { busy: null, message: null };
  let awaiting: 'copy' | 'join' | null = null;

  const set = (next: Partial<PreviewActionsState>) => {
    state = { ...state, ...next };
    deps.onChange(state);
  };
  const idle = (message: SaveMessage | null = state.message) => set({ busy: null, message });

  async function join(): Promise<void> {
    if (state.busy) return;
    if (!deps.getUserId()) {
      awaiting = 'join';
      set({ busy: 'join', message: null });
      if (!(await deps.signIn())) {
        awaiting = null;
        idle({ text: 'Sign in to join this Trip.', tone: 'muted' });
      }
      return;
    }
    set({ busy: 'join', message: null });
    const result = await deps.join(deps.collectionId);
    if (result.ok) {
      idle(null);
      deps.onJoined();
      return;
    }
    idle({ text: membershipErrorMessage('joining', result.error), tone: 'danger' });
  }

  async function saveCopy(): Promise<void> {
    const preview = deps.getPreview();
    if (state.busy || !preview) return;
    set({ busy: 'copy', message: null });

    // The preview already holds the creator's notes; an incomplete one is refused, never copied.
    let copySource: SharedTrip;
    try {
      copySource = toPreviewSnapshot(preview);
    } catch {
      idle({
        text: "This Trip's details are incomplete right now, so no copy was made. Please try again later.",
        tone: 'danger',
      });
      return;
    }

    const outcome = await saveCopyFromSnapshot(deps.copyDependencies, {
      collectionId: deps.collectionId,
      mode: 'tap',
      trip: copySource,
      userId: deps.getUserId(),
    });
    if (outcome.kind === 'saved') {
      idle(null);
      deps.onSaved(outcome.tripId);
      return;
    }
    if (outcome.kind === 'needs-sign-in') {
      awaiting = 'copy';
      if (await deps.signIn()) return; // the session arriving continues this same Save
      awaiting = null;
      idle(describeSaveFeedback({ kind: 'sign-in-cancelled' }));
      return;
    }
    idle(describeSaveFeedback(outcome as SaveFeedback));
  }

  /** Call when the signed-in user changes: continues the action that was waiting for sign-in. */
  function sessionChanged(): void {
    const waiting = awaiting;
    if (!waiting || !deps.getUserId()) return;
    awaiting = null;
    set({ busy: null });
    void (waiting === 'join' ? join() : saveCopy());
  }

  return { getState: () => state, join, saveCopy, sessionChanged };
}

export type PreviewActions = ReturnType<typeof createPreviewActions>;
