import { ApiError, authenticatedApiFetch } from '@/lib/api-client';
import type {
  ApiEditorialTripEntry,
  ApiTripSummary,
  MyTrip,
  MyTripPlace,
} from '@/trips/types';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseSummary(value: unknown): ApiTripSummary {
  if (!value || typeof value !== 'object') {
    throw new ApiError(500, 'malformed_response');
  }
  const item = value as Partial<ApiTripSummary>;
  if (
    typeof item.id !== 'string' ||
    typeof item.name !== 'string' ||
    !(item.description === null || typeof item.description === 'string') ||
    !isStringArray(item.entryOrder)
  ) {
    throw new ApiError(500, 'malformed_response');
  }
  return {
    description: item.description,
    entryOrder: item.entryOrder,
    id: item.id,
    name: item.name,
  };
}

function parseEditorialEntry(value: unknown): ApiEditorialTripEntry {
  if (!value || typeof value !== 'object') {
    throw new ApiError(500, 'malformed_response');
  }
  const entry = value as Partial<ApiEditorialTripEntry>;
  if (
    entry.type !== 'editorialPlace' ||
    typeof entry.id !== 'string' ||
    typeof entry.itineraryId !== 'string' ||
    typeof entry.order !== 'number' ||
    !(entry.note === null || typeof entry.note === 'string') ||
    !entry.editorialPlace ||
    typeof entry.editorialPlace.id !== 'string'
  ) {
    throw new ApiError(500, 'unsupported_trip_entry');
  }
  return entry as ApiEditorialTripEntry;
}

export async function listTripSummaries(): Promise<ApiTripSummary[]> {
  const response = await authenticatedApiFetch<unknown>('/itinerary');
  if (!Array.isArray(response)) throw new ApiError(500, 'malformed_response');
  return response.map(parseSummary);
}

export async function listEditorialTripEntries(
  itineraryId: string
): Promise<ApiEditorialTripEntry[]> {
  const response = await authenticatedApiFetch<unknown>(
    `/itinerary/${encodeURIComponent(itineraryId)}/entries`
  );
  if (!Array.isArray(response)) throw new ApiError(500, 'malformed_response');
  return response.map(parseEditorialEntry).sort((a, b) => a.order - b.order);
}

export async function loadTrip(
  summary: ApiTripSummary,
  cached?: MyTrip
): Promise<MyTrip> {
  const entries = await listEditorialTripEntries(summary.id);
  const timestamp = new Date().toISOString();
  const cachedByEntry = new Map(
    (cached?.places ?? []).map((place) => [place.entryId, place])
  );
  return {
    createdAt: cached?.createdAt || timestamp,
    id: summary.id,
    name: summary.name,
    note: summary.description ?? '',
    places: entries.map<MyTripPlace>((entry) => ({
      addedAt: cachedByEntry.get(entry.id)?.addedAt || timestamp,
      entryId: entry.id,
      note: entry.note ?? '',
      placeId: entry.editorialPlace.id,
    })),
    updatedAt: timestamp,
  };
}

export async function listTrips(cached: MyTrip[] = []): Promise<MyTrip[]> {
  const cachedById = new Map(cached.map((trip) => [trip.id, trip]));
  const summaries = await listTripSummaries();
  return Promise.all(
    summaries.map((summary) => loadTrip(summary, cachedById.get(summary.id)))
  );
}

export async function createTripRequest(input: {
  description?: string;
  entryOrder?: string[];
  id?: string;
  name: string;
}): Promise<string> {
  const response = await authenticatedApiFetch<{ id?: unknown }>('/itinerary', {
    body: JSON.stringify({
      description: input.description,
      entryOrder: input.entryOrder ?? [],
      id: input.id,
      name: input.name,
    }),
    method: 'POST',
  });
  if (typeof response?.id !== 'string') {
    throw new ApiError(500, 'malformed_response');
  }
  return response.id;
}

export async function updateTripRequest(
  itineraryId: string,
  input: { description?: string; entryOrder: string[]; name?: string }
): Promise<void> {
  await authenticatedApiFetch(`/itinerary/${encodeURIComponent(itineraryId)}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export async function deleteTripRequest(itineraryId: string): Promise<void> {
  await authenticatedApiFetch(`/itinerary/${encodeURIComponent(itineraryId)}`, {
    method: 'DELETE',
  });
}

export async function addEditorialEntryRequest(
  itineraryId: string,
  input: { id?: string; note?: string; placeId: string }
): Promise<string> {
  const response = await authenticatedApiFetch<{ id?: unknown }>(
    `/itinerary/${encodeURIComponent(itineraryId)}/entry`,
    {
      body: JSON.stringify({
        id: input.id,
        note: input.note,
        placeId: input.placeId,
        type: 'editorialPlace',
      }),
      method: 'POST',
    }
  );
  if (typeof response?.id !== 'string') {
    throw new ApiError(500, 'malformed_response');
  }
  return response.id;
}

export async function updateEntryNoteRequest(
  itineraryId: string,
  entryId: string,
  note: string
): Promise<void> {
  await authenticatedApiFetch(
    `/itinerary/${encodeURIComponent(itineraryId)}/entry/${encodeURIComponent(entryId)}`,
    { body: JSON.stringify({ note }), method: 'PATCH' }
  );
}

export async function deleteEntryRequest(
  itineraryId: string,
  entryId: string
): Promise<void> {
  await authenticatedApiFetch(
    `/itinerary/${encodeURIComponent(itineraryId)}/entry/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' }
  );
}
