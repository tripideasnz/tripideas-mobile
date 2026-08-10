import { ApiError } from '@/lib/api-client';
import { CreateTripWithPlaceError } from '@/trips/workflow-errors';

export function tripRequestDiagnostic(error: unknown): string {
  const cause = error instanceof CreateTripWithPlaceError ? error.cause : error;
  if (!(cause instanceof ApiError)) return '';
  return ` (${cause.status}: ${cause.code})`;
}
