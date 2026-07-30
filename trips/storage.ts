import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  MyTrip,
  MyTripPlace,
  TripMigrationJournal,
} from '@/trips/types';

const MY_TRIPS_KEY = 'tripideas.myTrips.v1';
const VERSION = 'v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

function normalizeTripPlace(value: unknown): MyTripPlace | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const place = value as Partial<MyTripPlace>;
  const placeId = typeof place.placeId === 'string' ? place.placeId.trim() : '';

  if (!placeId) {
    return null;
  }

  return {
    addedAt: typeof place.addedAt === 'string' ? place.addedAt : '',
    entryId: typeof place.entryId === 'string' ? place.entryId : undefined,
    note: typeof place.note === 'string' ? place.note : '',
    placeId,
  };
}

function normalizeTrip(value: unknown, deduplicatePlaces = true): MyTrip | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const trip = value as Partial<MyTrip>;
  const id = typeof trip.id === 'string' ? trip.id.trim() : '';
  const name = typeof trip.name === 'string' ? trip.name.trim() : '';

  if (!id || !name) {
    return null;
  }

  const places = Array.isArray(trip.places)
    ? trip.places
        .map(normalizeTripPlace)
        .filter((place): place is MyTripPlace => Boolean(place))
        .filter((place, index, allPlaces) =>
          !deduplicatePlaces ||
          allPlaces.findIndex((candidate) => candidate.placeId === place.placeId) ===
            index
        )
    : [];

  return {
    createdAt: typeof trip.createdAt === 'string' ? trip.createdAt : '',
    id,
    name,
    note: typeof trip.note === 'string' ? trip.note : '',
    places,
    updatedAt: typeof trip.updatedAt === 'string' ? trip.updatedAt : '',
  };
}

function normalizeTrips(values: unknown[], deduplicatePlaces = true) {
  return values
    .map((value) => normalizeTrip(value, deduplicatePlaces))
    .filter((trip): trip is MyTrip => Boolean(trip))
    .filter(
      (trip, index, allTrips) =>
        allTrips.findIndex((candidate) => candidate.id === trip.id) === index
    );
}

export async function getMyTrips() {
  const rawValue = await AsyncStorage.getItem(MY_TRIPS_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? normalizeTrips(parsedValue) : [];
  } catch {
    return [];
  }
}

export async function setMyTrips(trips: MyTrip[]) {
  const normalizedTrips = normalizeTrips(trips);
  await AsyncStorage.setItem(MY_TRIPS_KEY, JSON.stringify(normalizedTrips));
  return normalizedTrips;
}

export function tripCacheKey(userId: string) {
  return `tripideas.trips.user.${userId}.${VERSION}`;
}

export function tripMigrationJournalKey(userId: string) {
  return `tripideas.tripMigration.user.${userId}.${VERSION}`;
}

export const TRIP_MIGRATION_CLAIM_KEY = 'tripideas.tripMigration.claim.v1';

export function createTripStorage(storage: Storage = AsyncStorage) {
  return {
    getLegacyTrips: getMyTrips,
    async getCache(userId: string) {
      const raw = await storage.getItem(tripCacheKey(userId));
      if (!raw) return [];
      try {
        const value = JSON.parse(raw);
        return Array.isArray(value) ? normalizeTrips(value, false) : [];
      } catch {
        return [];
      }
    },
    async setCache(userId: string, trips: MyTrip[]) {
      const normalized = normalizeTrips(trips, false);
      await storage.setItem(tripCacheKey(userId), JSON.stringify(normalized));
      return normalized;
    },
    async getJournal(userId: string): Promise<TripMigrationJournal | null> {
      const raw = await storage.getItem(tripMigrationJournalKey(userId));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as TripMigrationJournal;
      } catch {
        return null;
      }
    },
    async setJournal(userId: string, journal: TripMigrationJournal) {
      await storage.setItem(
        tripMigrationJournalKey(userId),
        JSON.stringify(journal)
      );
    },
    async getClaim(): Promise<{ sourceFingerprint: string; userId: string } | null> {
      const raw = await storage.getItem(TRIP_MIGRATION_CLAIM_KEY);
      if (!raw) return null;
      try {
        const value = JSON.parse(raw);
        return typeof value?.sourceFingerprint === 'string' &&
          typeof value?.userId === 'string'
          ? value
          : null;
      } catch {
        return null;
      }
    },
    async setClaim(claim: { sourceFingerprint: string; userId: string }) {
      await storage.setItem(TRIP_MIGRATION_CLAIM_KEY, JSON.stringify(claim));
    },
  };
}

export const tripStorage = createTripStorage();
