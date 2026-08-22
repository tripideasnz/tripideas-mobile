export type DiaryContentOrigin = 'USER_OWNED' | 'TRIPIDEAS_SUPPLIED';
export type DiaryItemSourceKind =
  | 'NOTEBOOK_BLOCK' | 'TRIP' | 'ITINERARY_ENTRY'
  | 'PERSONAL_PLACE_CARD' | 'PHOTO_ASSET' | 'EDITORIAL_PLACE';

export type DiaryItemSource = {
  sourceKind: DiaryItemSourceKind;
  sourceId: string;
  sourceVersion: number | null;
  evidenceRole: string | null;
};

type DiaryItemBase = {
  id: string;
  position: number;
  creationMethod: 'USER' | 'AI';
  contentOrigin: DiaryContentOrigin;
  manuallyEditedAt: string | null;
  includeOnMap: boolean;
  sources: DiaryItemSource[];
};

export type DiaryItem =
  | DiaryItemBase & { type: 'NARRATIVE'; title: string | null; text: string }
  | DiaryItemBase & { type: 'PHOTO'; photoAssetId: string; caption: string | null }
  | DiaryItemBase & { type: 'LINK'; url: string; title: string | null; note: string | null }
  | DiaryItemBase & { type: 'EDITORIAL_PLACE'; editorialPlaceId: string; presentationTitle: string; location: DiaryCoordinates | null }
  | DiaryItemBase & { type: 'PERSONAL_PLACE'; personalPlaceCardId: string; presentationTitle: string; presentationBody: string | null; location: DiaryCoordinates | null }
  | DiaryItemBase & { type: 'LOCATION'; label: string | null; location: DiaryCoordinates };
export type NewDiaryItem = DiaryItem extends infer T
  ? T extends DiaryItem
    ? Omit<T, 'id' | 'position' | 'creationMethod' | 'manuallyEditedAt' | 'sources'>
    : never
  : never;

export type DiaryCoordinates = { latitude: number; longitude: number };
export type DiaryTopic = { id: string; title: string; startTime: string | null; position: number; version: number; creationMethod: 'USER' | 'AI'; manuallyEditedAt: string | null; items: DiaryItem[] };
export type DiaryDay = { id: string; date: string; heading: string | null; summary: string | null; position: number; topics: DiaryTopic[] };
export type DiarySource = { sourceKind: 'NOTEBOOK' | 'TRIP'; sourceId: string; addedAt: string };
export type Diary = { id: string; title: string; description: string | null; coverPhotoAssetId: string | null; startDate: string | null; endDate: string | null; state: 'ACTIVE'; version: number; days: DiaryDay[]; sources: DiarySource[]; createdAt: string; updatedAt: string };

export type DiarySourceCandidate = {
  sourceKind: DiaryItemSourceKind;
  sourceId: string;
  displayTitle: string;
  eventAt: string | null;
  capturedAt: string | null;
  sourceOrder: number | null;
  tripOrder: number | null;
  createdAt: string;
  locationEvidence: DiaryCoordinates | null;
  contentOrigin: DiaryContentOrigin;
  presentation: Record<string, unknown>;
};
