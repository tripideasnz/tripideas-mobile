import { ApiError, authenticatedApiFetch } from '@/lib/api-client';
import type {
  PersonalPlaceCard,
  PersonalPlaceCardInput,
  PersonalPlaceCardMedia,
} from './types';

export const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(500, 'malformed_response');
  }
  return value as Record<string, unknown>;
};
export const string = (value: unknown) => {
  if (typeof value !== 'string') throw new ApiError(500, 'malformed_response');
  return value;
};
const nullableString = (value: unknown) => value === null ? null : string(value);
export const integer = (value: unknown) => {
  if (!Number.isInteger(value)) throw new ApiError(500, 'malformed_response');
  return value as number;
};

function parseMedia(value: unknown): PersonalPlaceCardMedia {
  const data = object(value);
  if (
    (data.role !== 'main' && data.role !== 'body') ||
    !(data.position === null || Number.isInteger(data.position))
  ) throw new ApiError(500, 'malformed_response');
  return {
    createdAt: string(data.createdAt),
    id: string(data.id),
    photoAssetId: string(data.photoAssetId),
    position: data.position as number | null,
    role: data.role,
    updatedAt: string(data.updatedAt),
  };
}

export function parsePersonalPlaceCard(value: unknown): PersonalPlaceCard {
  const data = object(value);
  const readiness = object(data.readiness);
  if (
    typeof readiness.isTripIdeaReady !== 'boolean' ||
    !Array.isArray(readiness.readinessIssues) ||
    !readiness.readinessIssues.every((item) => typeof item === 'string') ||
    !Array.isArray(data.media)
  ) throw new ApiError(500, 'malformed_response');
  let location: PersonalPlaceCard['location'] = null;
  if (data.location !== null) {
    const raw = object(data.location);
    if (
      typeof raw.latitude !== 'number' ||
      typeof raw.longitude !== 'number' ||
      typeof raw.confirmed !== 'boolean' ||
      !(raw.confirmedAt === null || typeof raw.confirmedAt === 'string') ||
      !(
        raw.source === null ||
        raw.source === 'PHOTO_METADATA' ||
        raw.source === 'USER_SELECTED'
      )
    ) throw new ApiError(500, 'malformed_response');
    location = {
      confirmed: raw.confirmed,
      confirmedAt: raw.confirmedAt,
      latitude: raw.latitude,
      longitude: raw.longitude,
      source: raw.source,
    };
  }
  return {
    body: nullableString(data.body),
    createdAt: string(data.createdAt),
    id: string(data.id),
    location,
    media: data.media.map(parseMedia),
    readiness: {
      isTripIdeaReady: readiness.isTripIdeaReady,
      readinessIssues: readiness.readinessIssues as string[],
    },
    title: nullableString(data.title),
    updatedAt: string(data.updatedAt),
    version: integer(data.version),
  };
}

const request = (method: string, body?: unknown): RequestInit => ({
  body: body === undefined ? undefined : JSON.stringify(body),
  method,
});

export async function listPersonalPlaceCards(): Promise<PersonalPlaceCard[]> {
  const data = object(await authenticatedApiFetch('/personal-place-cards'));
  if (!Array.isArray(data.cards)) throw new ApiError(500, 'malformed_response');
  return data.cards.map(parsePersonalPlaceCard);
}

export async function readPersonalPlaceCard(id: string) {
  return parsePersonalPlaceCard(
    await authenticatedApiFetch(`/personal-place-cards/${encodeURIComponent(id)}`)
  );
}

export async function createPersonalPlaceCard(
  input: PersonalPlaceCardInput & { clientRequestId: string }
) {
  return parsePersonalPlaceCard(
    await authenticatedApiFetch('/personal-place-cards', request('POST', input))
  );
}

export async function updatePersonalPlaceCard(
  id: string,
  expectedVersion: number,
  input: PersonalPlaceCardInput
) {
  return parsePersonalPlaceCard(
    await authenticatedApiFetch(
      `/personal-place-cards/${encodeURIComponent(id)}`,
      request('PATCH', { expectedVersion, ...input })
    )
  );
}

export async function attachPersonalPlaceCardMedia(
  id: string,
  input: {
    expectedVersion: number;
    photoAssetId: string;
    position?: number;
    role: 'main' | 'body';
  }
) {
  return parsePersonalPlaceCard(
    await authenticatedApiFetch(
      `/personal-place-cards/${encodeURIComponent(id)}/media`,
      request('POST', input)
    )
  );
}

export async function removePersonalPlaceCardMedia(
  id: string,
  mediaId: string,
  expectedVersion: number
) {
  return parsePersonalPlaceCard(
    await authenticatedApiFetch(
      `/personal-place-cards/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}`,
      request('DELETE', { expectedVersion })
    )
  );
}

export async function reorderPersonalPlaceCardMedia(
  id: string,
  expectedVersion: number,
  mediaIds: string[]
) {
  return parsePersonalPlaceCard(
    await authenticatedApiFetch(
      `/personal-place-cards/${encodeURIComponent(id)}/media/order`,
      request('PUT', { expectedVersion, mediaIds })
    )
  );
}

export async function deletePersonalPlaceCard(
  id: string,
  expectedVersion: number
) {
  const data = object(
    await authenticatedApiFetch(
      `/personal-place-cards/${encodeURIComponent(id)}`,
      request('DELETE', { expectedVersion })
    )
  );
  if (data.state !== 'deleted') throw new ApiError(500, 'malformed_response');
  return {
    deletedAt: string(data.deletedAt),
    id: string(data.id),
    state: 'deleted' as const,
    version: integer(data.version),
  };
}
