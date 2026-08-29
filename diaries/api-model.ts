import type { Diary, DiaryItem } from '@/diaries/types';

export class DiaryApiParseError extends Error {
  constructor() {
    super('Malformed Diary API response');
    this.name = 'DiaryApiParseError';
  }
}

export type DiaryApiSummary = {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type Location = {
  latitude: number;
  longitude: number;
  source: 'PLACE_SNAPSHOT' | 'PIN_NOW' | 'MAP_SELECTED';
  accuracyMeters: number | null;
};

type ObjectBase = {
  id: string;
  position: number;
  clientRequestId: string;
  includeOnMap: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DiaryApiObject =
  | ObjectBase & { type: 'NARRATIVE'; title: string | null; text: string }
  | ObjectBase & { type: 'PHOTO'; photoAssetId: string; caption: string | null }
  | ObjectBase & { type: 'LINK'; url: string; title: string | null; note: string | null }
  | ObjectBase & { type: 'EDITORIAL_PLACE'; availability: 'available'; titleSnapshot: string; reference: { kind: 'editorial'; editorialPlaceId: string }; locationSnapshot: Location | null }
  | ObjectBase & { type: 'PERSONAL_PLACE'; availability: 'available' | 'unavailable'; titleSnapshot: string; reference: { kind: 'personal'; personalPlaceCardId: string }; locationSnapshot: Location | null }
  | ObjectBase & { type: 'PIN'; label: string | null; location: Location };

export type DiaryApiDetail = DiaryApiSummary & {
  state: 'active';
  deletedAt: null;
  coverMedia: { id: string; photoAssetId: string; position: number; clientRequestId: string; createdAt: string }[];
  days: {
    id: string;
    date: string;
    heading: string | null;
    summary: string | null;
    createdAt: string;
    updatedAt: string;
    topics: {
      id: string;
      title: string;
      startTime: string | null;
      position: number;
      createdAt: string;
      updatedAt: string;
      objects: DiaryApiObject[];
    }[];
  }[];
};

const malformed = (): never => { throw new DiaryApiParseError(); };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : malformed();
const text = (value: unknown) => typeof value === 'string' ? value : malformed();
const nullableText = (value: unknown) => value === null ? null : text(value);
const integer = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : malformed();
const bool = (value: unknown) => typeof value === 'boolean' ? value : malformed();
const date = (value: unknown) => value === null ? null : /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? value as string : malformed();
const time = (value: unknown) => value === null ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(text(value)) ? value as string : malformed();
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : malformed();
const array = (value: unknown) => Array.isArray(value) ? value : malformed();

const ordered = <T extends { position: number }>(values: T[]) => {
  if (new Set(values.map(({ position }) => position)).size !== values.length) malformed();
  return [...values].sort((a, b) => a.position - b.position);
};

function parseLocation(value: unknown, place: boolean): Location | null {
  if (value === null) return null;
  const data = record(value);
  const source = text(data.source);
  if (place ? source !== 'PLACE_SNAPSHOT' : source !== 'PIN_NOW' && source !== 'MAP_SELECTED') malformed();
  const latitude = finite(data.latitude);
  const longitude = finite(data.longitude);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) malformed();
  const accuracyMeters = data.accuracyMeters === null ? null : finite(data.accuracyMeters);
  if (accuracyMeters !== null && accuracyMeters < 0) malformed();
  return { latitude, longitude, source, accuracyMeters } as Location;
}

function parseObject(value: unknown): DiaryApiObject {
  const data = record(value);
  const type = text(data.type);
  const base = {
    id: text(data.id), position: integer(data.position), clientRequestId: text(data.clientRequestId),
    includeOnMap: bool(data.includeOnMap), createdAt: text(data.createdAt), updatedAt: text(data.updatedAt),
  };
  if (type === 'NARRATIVE') return { ...base, type, title: nullableText(data.title), text: text(data.text) };
  if (type === 'PHOTO') return { ...base, type, photoAssetId: text(data.photoAssetId), caption: nullableText(data.caption) };
  if (type === 'LINK') return { ...base, type, url: text(data.url), title: nullableText(data.title), note: nullableText(data.note) };
  if (type === 'EDITORIAL_PLACE') {
    const reference = record(data.reference);
    if (data.availability !== 'available' || reference.kind !== 'editorial') malformed();
    return { ...base, type, availability: 'available', titleSnapshot: text(data.titleSnapshot), reference: { kind: 'editorial', editorialPlaceId: text(reference.editorialPlaceId) }, locationSnapshot: parseLocation(data.locationSnapshot, true) };
  }
  if (type === 'PERSONAL_PLACE') {
    const reference = record(data.reference);
    if ((data.availability !== 'available' && data.availability !== 'unavailable') || reference.kind !== 'personal') malformed();
    const availability = data.availability as 'available' | 'unavailable';
    const locationSnapshot = parseLocation(data.locationSnapshot, true);
    if (availability === 'unavailable' && locationSnapshot !== null) malformed();
    return { ...base, type, availability, titleSnapshot: text(data.titleSnapshot), reference: { kind: 'personal', personalPlaceCardId: text(reference.personalPlaceCardId) }, locationSnapshot };
  }
  if (type === 'PIN') {
    const location = parseLocation(data.location, false);
    if (!location) return malformed();
    return { ...base, type, label: nullableText(data.label), location };
  }
  return malformed();
}

export function parseDiarySummary(value: unknown): DiaryApiSummary {
  const data = record(value);
  return {
    id: text(data.id), title: text(data.title), description: nullableText(data.description),
    startDate: date(data.startDate), endDate: date(data.endDate), version: integer(data.version),
    createdAt: text(data.createdAt), updatedAt: text(data.updatedAt),
  };
}

export function parseDiaryList(value: unknown): DiaryApiSummary[] {
  const data = record(value);
  return array(data.diaries).map(parseDiarySummary);
}

export function parseDiaryDetail(value: unknown): DiaryApiDetail {
  const data = record(value);
  const summary = parseDiarySummary(data);
  if (data.state !== 'active' || data.deletedAt !== null) malformed();
  const coverMedia = ordered(array(data.coverMedia).map((value) => {
    const media = record(value);
    return { id: text(media.id), photoAssetId: text(media.photoAssetId), position: integer(media.position), clientRequestId: text(media.clientRequestId), createdAt: text(media.createdAt) };
  }));
  const days = array(data.days).map((value) => {
    const day = record(value);
    const topics = ordered(array(day.topics).map((value) => {
      const topic = record(value);
      return { id: text(topic.id), title: text(topic.title), startTime: time(topic.startTime), position: integer(topic.position), createdAt: text(topic.createdAt), updatedAt: text(topic.updatedAt), objects: ordered(array(topic.objects).map(parseObject)) };
    }));
    return { id: text(day.id), date: date(day.date) ?? malformed(), heading: nullableText(day.heading), summary: nullableText(day.summary), createdAt: text(day.createdAt), updatedAt: text(day.updatedAt), topics };
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(days.map(({ date }) => date)).size !== days.length) malformed();
  return { ...summary, state: 'active', deletedAt: null, coverMedia, days };
}

const itemBase = (item: DiaryApiObject) => ({ id: item.id, position: item.position, creationMethod: 'USER' as const, contentOrigin: 'USER_OWNED' as const, manuallyEditedAt: null, includeOnMap: item.includeOnMap, sources: [] });
const toItem = (item: DiaryApiObject): DiaryItem => {
  const base = itemBase(item);
  if (item.type === 'NARRATIVE') return { ...base, type: item.type, title: item.title, text: item.text };
  if (item.type === 'PHOTO') return { ...base, type: item.type, photoAssetId: item.photoAssetId, caption: item.caption };
  if (item.type === 'LINK') return { ...base, type: item.type, url: item.url, title: item.title, note: item.note };
  if (item.type === 'EDITORIAL_PLACE') return { ...base, type: item.type, editorialPlaceId: item.reference.editorialPlaceId, presentationTitle: item.titleSnapshot, location: item.locationSnapshot && { latitude: item.locationSnapshot.latitude, longitude: item.locationSnapshot.longitude } };
  if (item.type === 'PERSONAL_PLACE') return { ...base, type: item.type, personalPlaceCardId: item.reference.personalPlaceCardId, presentationTitle: item.titleSnapshot, presentationBody: null, location: item.locationSnapshot && { latitude: item.locationSnapshot.latitude, longitude: item.locationSnapshot.longitude } };
  return { ...base, type: 'LOCATION', label: item.label, location: { latitude: item.location.latitude, longitude: item.location.longitude } };
};

export const diarySummaryView = (summary: DiaryApiSummary): Diary => ({ ...summary, state: 'ACTIVE', coverPhotoAssetId: null, coverPhotoAssetIds: [], days: [], sources: [] });
export const diaryDetailView = (detail: DiaryApiDetail): Diary => ({ ...diarySummaryView(detail), coverPhotoAssetId: detail.coverMedia[0]?.photoAssetId ?? null, coverPhotoAssetIds: detail.coverMedia.map(({ photoAssetId }) => photoAssetId), days: detail.days.map((day, position) => ({ id: day.id, date: day.date, heading: day.heading, summary: day.summary, position, topics: day.topics.map((topic) => ({ id: topic.id, title: topic.title, startTime: topic.startTime, position: topic.position, version: detail.version, creationMethod: 'USER', manuallyEditedAt: null, items: topic.objects.map(toItem) })) })) });
