export type PersonalPlaceCardMedia = {
  createdAt: string;
  id: string;
  photoAssetId: string;
  position: number | null;
  role: 'main' | 'body';
  updatedAt: string;
};

export type PersonalPlaceCard = {
  body: string | null;
  createdAt: string;
  id: string;
  location: {
    confirmed: boolean;
    confirmedAt: string | null;
    latitude: number;
    longitude: number;
    source: 'PHOTO_METADATA' | 'USER_SELECTED' | null;
  } | null;
  media: PersonalPlaceCardMedia[];
  readiness: {
    isTripIdeaReady: boolean;
    readinessIssues: string[];
  };
  title: string | null;
  updatedAt: string;
  version: number;
};

export type PersonalPlaceCardInput = {
  body?: string | null;
  latitude?: number | null;
  locationConfirmed?: boolean;
  locationSource?: 'PHOTO_METADATA' | 'USER_SELECTED' | null;
  longitude?: number | null;
  title?: string | null;
};

export type EditorialTripEntry = {
  editorialPlace: { id: string };
  id: string;
  itineraryId: string;
  note: string | null;
  order: number;
  type: 'editorialPlace';
};

export type PersonalCardTripEntry = {
  id: string;
  itineraryId: string;
  note: string | null;
  order: number;
  personalPlaceCard: PersonalPlaceCard;
  type: 'personalPlaceCard';
};

export type UnavailableTripEntry = {
  id: string;
  itineraryId: string;
  note: string | null;
  order: number;
  type: 'personalPlaceCard';
  unavailable: { reason: 'personal_place_card_unavailable' };
};

export type TripEntry =
  | EditorialTripEntry
  | PersonalCardTripEntry
  | UnavailableTripEntry;
