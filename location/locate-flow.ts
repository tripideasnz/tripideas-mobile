// State and wording for the Personal Place "Locate now" control.
//
// A fresh fix is saved as before (the user's tap is the confirmation). A
// cached/approximate position is never saved on its own: the user must confirm
// it, or choose the location on the map instead.
import {
  describeLocationFailure,
  failureNeedsSettings,
  type LocationFailureReason,
  type LocationFix,
} from '@/location/foreground-acquire';

export type LocateState =
  | { kind: 'idle' }
  | { approximate: LocationFix | null; kind: 'locating' }
  | { fix: LocationFix; kind: 'confirm-approximate'; reason: 'timeout' | 'unavailable' }
  | { kind: 'saving' }
  | { approximate: boolean; kind: 'saved' }
  | { kind: 'failed'; message: string; reason: LocationFailureReason | 'save-failed' };

export type LocateEvent =
  | { type: 'started' }
  | { fix: LocationFix; type: 'approximate' }
  | { fix: LocationFix; reason: 'timeout' | 'unavailable'; type: 'needs-confirmation' }
  | { reason: LocationFailureReason; type: 'failed' }
  | { type: 'save-started' }
  | { approximate: boolean; type: 'saved' }
  | { message: string; type: 'save-failed' }
  | { type: 'dismissed' };

export const initialLocateState: LocateState = { kind: 'idle' };

export function locateReducer(state: LocateState, event: LocateEvent): LocateState {
  switch (event.type) {
    case 'started':
      return { approximate: null, kind: 'locating' };
    case 'approximate':
      return state.kind === 'locating' ? { approximate: event.fix, kind: 'locating' } : state;
    case 'needs-confirmation':
      return { fix: event.fix, kind: 'confirm-approximate', reason: event.reason };
    case 'failed':
      return { kind: 'failed', message: describeLocationFailure(event.reason), reason: event.reason };
    case 'save-started':
      return { kind: 'saving' };
    case 'saved':
      return { approximate: event.approximate, kind: 'saved' };
    case 'save-failed':
      return { kind: 'failed', message: event.message, reason: 'save-failed' };
    case 'dismissed':
      return initialLocateState;
  }
}

/** True while a request or save is running (the control is disabled). */
export const isLocateBusy = (state: LocateState) =>
  state.kind === 'locating' || state.kind === 'saving';

const minutesAgo = (ageMs: number) => {
  const minutes = Math.round(ageMs / 60_000);
  return minutes <= 0 ? 'moments ago' : minutes === 1 ? 'about a minute ago' : `about ${minutes} minutes ago`;
};

/** Approximate positions are described by age and rough radius, never by raw precision. */
const approximateRadius = (fix: LocationFix) => {
  const meters = fix.point.accuracyMeters;
  if (meters === null) return '';
  return meters < 100 ? '' : ` (within about ${Math.round(meters / 100) * 100} m)`;
};

export type LocateStatus = {
  needsSettings: boolean;
  text: string;
  tone: 'danger' | 'muted' | 'success';
};

export function locateStatus(state: LocateState): LocateStatus | null {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'locating':
      return {
        needsSettings: false,
        text: state.approximate
          ? `Using a recent position from ${minutesAgo(state.approximate.ageMs)}. Improving accuracy…`
          : 'Finding your location…',
        tone: 'muted',
      };
    case 'confirm-approximate':
      return {
        needsSettings: false,
        text: `We could only find an approximate location from ${minutesAgo(state.fix.ageMs)}${approximateRadius(state.fix)}. Save it, or choose the location on the map.`,
        tone: 'muted',
      };
    case 'saving':
      return { needsSettings: false, text: 'Saving location…', tone: 'muted' };
    case 'saved':
      return {
        needsSettings: false,
        text: state.approximate
          ? 'Approximate location saved. You can adjust it on the map.'
          : 'Location saved.',
        tone: 'success',
      };
    case 'failed':
      return {
        needsSettings: state.reason !== 'save-failed' && failureNeedsSettings(state.reason),
        text: state.message,
        tone: 'danger',
      };
  }
}
