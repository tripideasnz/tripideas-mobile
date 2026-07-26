import { ApiError } from '@/lib/api-client';

export type NotebookFailure =
  | 'conflict'
  | 'not-found'
  | 'offline'
  | 'validation'
  | 'unknown';

export function classifyNotebookError(error: unknown): NotebookFailure {
  if (!(error instanceof ApiError)) return 'offline';
  if (error.status === 409 && error.code === 'notebook_conflict') return 'conflict';
  if (error.status === 404) return 'not-found';
  if (error.status === 422) return 'validation';
  return 'unknown';
}
