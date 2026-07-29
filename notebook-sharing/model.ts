import { ApiError } from '@/lib/api-client';
import type {
  NotebookShareCapability,
  NotebookShareState,
} from '@/notebook-sharing/types';

export type SharingFailure =
  | 'authentication'
  | 'not-found'
  | 'offline'
  | 'unknown';

export function activeShareCapabilities(
  state: NotebookShareState | null
): NotebookShareCapability[] {
  return (state?.share?.capabilities ?? [])
    .filter((capability) => capability.state === 'active')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function classifySharingError(error: unknown): SharingFailure {
  if (!(error instanceof ApiError)) return 'offline';
  if (error.status === 401) return 'authentication';
  if (error.status === 404) return 'not-found';
  return 'unknown';
}

export function sharingErrorMessage(error: unknown): string {
  switch (classifySharingError(error)) {
    case 'authentication':
      return 'Please sign in again to manage sharing.';
    case 'not-found':
      return 'This Notebook is no longer available.';
    case 'offline':
      return 'You appear to be offline. Connect and try again.';
    default:
      return 'Could not update sharing. Please try again.';
  }
}

export function displayShareDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ''
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}
