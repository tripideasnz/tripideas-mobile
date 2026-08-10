import { ApiError } from '@/lib/api-client';
import { CreateTripWithPlaceError } from '@/trips/workflow-errors';

export function tripRequestDiagnostic(error: unknown): string {
  const cause = error instanceof CreateTripWithPlaceError ? error.cause : error;
  if (!(cause instanceof ApiError)) return '';
  const genericMessage = 'The request could not be completed.';
  const reason = cause.message !== genericMessage
    ? ` — ${cause.message.replace(/\s+/g, ' ').slice(0, 180)}`
    : '';
  return ` (${cause.status}: ${cause.code}${reason})`;
}
