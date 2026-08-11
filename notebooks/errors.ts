import { ApiError } from '@/lib/api-client';
import { isRouteUnavailableError } from '@/lib/api-compatibility';

export type NotebookFailure =
  | 'conflict'
  | 'not-found'
  | 'offline'
  | 'route-unavailable'
  | 'validation'
  | 'unknown';

export function classifyNotebookError(error: unknown): NotebookFailure {
  if (!(error instanceof ApiError)) return 'offline';
  if (isRouteUnavailableError(error)) return 'route-unavailable';
  if (error.status === 409 && error.code === 'notebook_conflict') return 'conflict';
  if (error.status === 404 && error.code === 'notebook_not_found') return 'not-found';
  if (error.status === 422) return 'validation';
  return 'unknown';
}
