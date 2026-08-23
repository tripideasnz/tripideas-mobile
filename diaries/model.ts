import type { Diary, DiaryContentOrigin, DiaryItem, DiarySourceCandidate } from '@/diaries/types';

const instant = (value: string | null) => value ? new Date(value).valueOf() : Infinity;
const order = (value: number | null) => value ?? Infinity;

export function proposedDiaryCandidateOrder(values: DiarySourceCandidate[]) {
  return [...values].sort((a, b) =>
    instant(a.eventAt) - instant(b.eventAt) ||
    instant(a.capturedAt) - instant(b.capturedAt) ||
    order(a.sourceOrder) - order(b.sourceOrder) ||
    order(a.tripOrder) - order(b.tripOrder) ||
    instant(a.createdAt) - instant(b.createdAt) ||
    a.sourceKind.localeCompare(b.sourceKind) || a.sourceId.localeCompare(b.sourceId)
  );
}

export function applyDiaryReorder<T extends { id: string }>(values: T[], ids: string[]) {
  if (values.length !== ids.length || new Set(ids).size !== ids.length ||
      values.some(({ id }) => !ids.includes(id))) throw new Error('Invalid Diary reorder');
  const byId = new Map(values.map((value) => [value.id, value]));
  return ids.map((id, position) => ({ ...byId.get(id)!, position }));
}

export function moveDiaryItem<T extends { id: string; position: number }>(values: T[], id: string, offset: -1 | 1) {
  const sorted = [...values].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((value) => value.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= sorted.length) return sorted;
  [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
  return sorted.map((value, position) => ({ ...value, position }));
}

export function appendDiaryMaterial<T extends { position: number }>(existing: T[], additions: Omit<T, 'position'>[]) {
  const current = [...existing].sort((a, b) => a.position - b.position);
  return [...current, ...additions.map((value, index) => ({ ...value, position: current.length + index } as T))];
}

export function deriveDiaryOrigin(items: Pick<DiaryItem, 'contentOrigin'>[]): DiaryContentOrigin | 'MIXED' | null {
  const values = new Set(items.map(({ contentOrigin }) => contentOrigin));
  return values.size === 0 ? null : values.size > 1 ? 'MIXED' : [...values][0];
}

export type DiaryMapItem = { itemId: string; kind: 'EDITORIAL_PLACE' | 'PERSONAL_PLACE' | 'LOCATION'; label: string | null; latitude: number; longitude: number };
export function diaryMapItems(items: DiaryItem[]): DiaryMapItem[] {
  return items.flatMap((item): DiaryMapItem[] => {
    if (!item.includeOnMap) return [];
    if (item.type === 'LOCATION') return [{ itemId: item.id, kind: item.type, label: item.label, ...item.location }];
    if ((item.type === 'EDITORIAL_PLACE' || item.type === 'PERSONAL_PLACE') && item.location) {
      return [{ itemId: item.id, kind: item.type, label: item.presentationTitle, ...item.location }];
    }
    return [];
  });
}

export type DiaryMapFeature = DiaryMapItem & { diaryId: string; dayId: string; topicId: string };
export function diaryMapFeatures(diary: Diary): DiaryMapFeature[] {
  return diary.days.flatMap((day) => day.topics.flatMap((topic) =>
    diaryMapItems(topic.items).map((feature) => ({ ...feature, diaryId: diary.id, dayId: day.id, topicId: topic.id }))
  ));
}

export function validateDiaryDates(startDate: string, endDate: string) {
  return startDate && endDate && startDate > endDate
    ? 'End date must not be before start date.'
    : null;
}

export function diaryCoverAssetIds(diary: {
  coverPhotoAssetId: string | null;
  coverPhotoAssetIds?: string[];
}): string[] {
  if (diary.coverPhotoAssetIds) return diary.coverPhotoAssetIds;
  return diary.coverPhotoAssetId ? [diary.coverPhotoAssetId] : [];
}
