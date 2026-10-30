export type MyTripPlace = {
  addedAt: string;
  entryId?: string;
  note: string;
  placeId: string;
};

export type MyTrip = {
  createdAt: string;
  id: string;
  name: string;
  note: string;
  entries?: TripEntry[];
  places: MyTripPlace[];
  updatedAt: string;
};

export type ApiTripSummary = {
  description: string | null;
  entryOrder: string[];
  id: string;
  name: string;
  /** The collection that publishes this Trip once shared; null (or absent on older APIs) otherwise. */
  sharedCollectionId?: string | null;
  /** The Trip's share link is on (the owner has not stopped sharing). Absent on older APIs. */
  sharingActive?: boolean;
};

export type ApiEditorialTripEntry = {
  editorialPlace: { id: string };
  id: string;
  itineraryId: string;
  note: string | null;
  order: number;
  type: 'editorialPlace';
};

export type TripMigrationState =
  | 'PENDING'
  | 'CREATING'
  | 'CREATED'
  | 'IMPORTING_ENTRIES'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'RETRYABLE_ERROR'
  | 'PERMANENT_ERROR';

export type TripMigrationJournalEntry = {
  attempts: number;
  completedAt: string | null;
  entryIds: string[];
  fingerprint: string;
  lastErrorCategory: string | null;
  localTripId: string;
  state: TripMigrationState;
  targetItineraryId: string;
  verified: boolean;
};

export type TripMigrationJournal = {
  acceptedAt: string;
  entries: TripMigrationJournalEntry[];
  sourceFingerprint: string;
  userId: string;
  version: 1;
};
import type { TripEntry } from '@/personal-place-cards/types';
