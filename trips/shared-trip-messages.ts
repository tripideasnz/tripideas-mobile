// User-facing wording for the shared-Trip Save outcomes. Plain language, no status codes.
import type { SaveOutcome } from '@/trips/shared-trip-save';

export type SaveMessage = {
  /** Offer to open the Trip this account already has. */
  openSavedTripId?: string;
  text: string;
  tone: 'danger' | 'muted';
};

export type SaveFeedback = SaveOutcome | { kind: 'sign-in-cancelled' };

export function describeSaveFeedback(feedback: SaveFeedback): SaveMessage | null {
  switch (feedback.kind) {
    case 'saved':
    case 'nothing-pending':
      return null;
    case 'needs-sign-in':
    case 'sign-in-cancelled':
      return { text: 'Sign in to save this Trip to your account.', tone: 'muted' };
    case 'unsupported':
      return {
        text: 'Saving shared Trips is not available yet. Please try again later.',
        tone: 'muted',
      };
    case 'offline':
      return {
        text: 'Could not reach TripIdeas. Check your connection, then tap Save again.',
        tone: 'danger',
      };
    case 'failed':
      return {
        text: 'Something went wrong while saving. Tap Save to try again.',
        tone: 'danger',
      };
    case 'rejected':
      return { text: 'This Trip could not be saved.', tone: 'danger' };
    case 'conflict':
      if (feedback.code === 'itinerary_import_content_mismatch') {
        return feedback.existingTripId
          ? {
              openSavedTripId: feedback.existingTripId,
              text: 'This Trip may already be saved in your account, and may have been edited since.',
              tone: 'muted',
            }
          : { text: 'This Trip could not be saved. Tap Save to try again.', tone: 'danger' };
      }
      if (feedback.code === 'itinerary_deleted') {
        return {
          text: 'You deleted the copy you saved earlier. Tap Save to save a new copy.',
          tone: 'muted',
        };
      }
      return { text: 'This Trip could not be saved. Tap Save to try again.', tone: 'danger' };
  }
}
