import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MyTrip, MyTripPlace } from '@/trips/types';

const MY_TRIPS_KEY = 'tripideas.myTrips.v1';

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
    note: typeof place.note === 'string' ? place.note : '',
    placeId,
  };
}

function normalizeTrip(value: unknown): MyTrip | null {
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
        .filter(
          (place, index, allPlaces) =>
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

function normalizeTrips(values: unknown[]) {
  return values
    .map(normalizeTrip)
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
