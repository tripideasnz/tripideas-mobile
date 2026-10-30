// The two choices on a Shared Trip preview, as a controller the screen wires to its buttons:
//
//  Join Trip    - joins the creator's live Trip (membership only; no copy is made).
//  Save a Copy  - a separate Trip owned by the recipient, through the existing Save workflow.
//
// Consent: opening a link does nothing. The tap IS the consent. When sign-in is needed the chosen action is
// remembered, sign-in runs, and the same action then completes (no second confirmation). That consent is
// withdrawn if the account that signs in is not the account the action started from (a session that
// lapsed for one person and was renewed by another), if sign-in is cancelled, or if the link changes
// (a new controller is made for each link). Save a Copy never proceeds without the creator's content;
// failures leave the person where they were with a message.
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
  /** Joins the live Trip (the store's join) with the link's token. */
  join: (collectionId: string, token: string | null) => Promise<ActionResult<unknown>>;
  onChange: (state: PreviewActionsState) => void;
  onJoined: () => void;
  onSaved: (tripId: string) => void;
  signIn: () => Promise<boolean>;
  /** The link's token (?k=), carried so Join can prove the person was given the link. */
  token: string | null;
};

export function createPreviewActions(deps: PreviewActionsDeps) {
  let state: PreviewActionsState = { busy: null, message: null };
  // The action waiting for sign-in, and the account that was signed in when it started (if any).
  let awaiting: { action: 'copy' | 'join'; from: string | null } | null = null;

  const set = (next: Partial<PreviewActionsState>) => {
    state = { ...state, ...next };
    deps.onChange(state);
  };
  const idle = (message: SaveMessage | null = state.message) => set({ busy: null, message });

  async function join(): Promise<void> {
    if (state.busy) return;
    if (!deps.getUserId()) {
      awaiting = { action: 'join', from: null }; // started signed out: any account that signs in is the person
      set({ busy: 'join', message: null });
      if (!(await deps.signIn())) {
        awaiting = null;
        idle({ text: 'Sign in to join this Trip.', tone: 'muted' });
      }
      return;
    }
    set({ busy: 'join', message: null });
    const result = await deps.join(deps.collectionId, deps.token);
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
      // The Save workflow found no usable session. If an account was still showing as signed in, the
      // session lapsed under it: only that same account may complete this action.
      awaiting = { action: 'copy', from: deps.getUserId() };
      if (await deps.signIn()) return; // the session arriving continues this same Save
      awaiting = null;
      idle(describeSaveFeedback({ kind: 'sign-in-cancelled' }));
      return;
    }
    idle(describeSaveFeedback(outcome as SaveFeedback));
  }

  /**
   * Call when the signed-in user changes: completes the action that was waiting for sign-in, unless the
   * account is not the one the action started from.
   */
  function sessionChanged(): void {
    const waiting = awaiting;
    const current = deps.getUserId();
    if (!waiting || !current) return;
    awaiting = null;
    if (waiting.from && waiting.from !== current) {
      idle({
        text: 'You signed in with a different account, so nothing was done. Choose Join Trip or Save a Copy again.',
        tone: 'muted',
      });
      return;
    }
    set({ busy: null });
    void (waiting.action === 'join' ? join() : saveCopy());
  }

  return { getState: () => state, join, saveCopy, sessionChanged };
}

export type PreviewActions = ReturnType<typeof createPreviewActions>;
