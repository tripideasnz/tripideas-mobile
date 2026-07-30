import { ApiError } from '@/lib/api-client';

const labels: Record<string, string> = {
  missing_title: 'Add a title.',
  missing_body: 'Add a description.',
  missing_eligible_main_photo: 'Add a main photo.',
  ineligible_body_photo: 'Remove or retry an unavailable photo.',
  missing_location: 'Add a location.',
  location_not_confirmed: 'Confirm the selected location.',
  card_unavailable: 'This Place Card is unavailable.',
};

export function readinessMessage(issues: string[]) {
  return issues.map((issue) => labels[issue] ?? 'Complete the remaining card details.').join(' ');
}

export function personalPlaceCardError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return 'The Place Card could not be saved. Check your connection and try again.';
  }
  if (error.code === 'personal_place_card_attached') {
    const count = Number(error.details?.activeAttachmentCount ?? 0);
    return `Remove this Place Card from ${count} active ${
      count === 1 ? 'Trip' : 'Trips'
    } before deleting it.`;
  }
  if (error.code === 'personal_place_card_attached_invalid') {
    const issues = Array.isArray(error.details?.readinessIssues)
      ? error.details.readinessIssues.filter((item): item is string => typeof item === 'string')
      : [];
    return `This attached Place Card must remain ready for its Trips. ${readinessMessage(issues)}`;
  }
  if (error.code === 'personal_place_card_conflict') {
    return 'This Place Card changed elsewhere. Reload it and try again.';
  }
  if (error.code === 'personal_place_card_already_attached') {
    return 'This Place Card is already in that Trip.';
  }
  if (error.code === 'personal_place_card_not_ready') {
    const issues = Array.isArray(error.details?.readinessIssues)
      ? error.details.readinessIssues.filter((item): item is string => typeof item === 'string')
      : [];
    return readinessMessage(issues);
  }
  if (error.status === 401) return 'Sign in again to continue.';
  if (error.status === 404) return 'This Place Card is no longer available.';
  return 'The Place Card could not be saved. Check your connection and try again.';
}
