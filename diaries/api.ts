import { ApiError, authenticatedApiFetch } from '@/lib/api-client';
import { DiaryApiParseError, parseDiaryDetail, parseDiaryList } from '@/diaries/api-model';

const json = (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body: unknown): RequestInit => ({ method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

const malformed = (error: unknown): never => {
  if (error instanceof DiaryApiParseError) throw new ApiError(500, 'malformed_response');
  throw error;
};

export async function listApiDiaries() {
  try {
    return parseDiaryList(await authenticatedApiFetch('/diaries'));
  } catch (error) {
    return malformed(error);
  }
}

export async function readApiDiary(id: string) {
  try {
    return parseDiaryDetail(await authenticatedApiFetch(`/diaries/${encodeURIComponent(id)}`));
  } catch (error) {
    return malformed(error);
  }
}

async function mutate(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body: unknown) {
  try { return parseDiaryDetail(await authenticatedApiFetch(path, json(method, body))); }
  catch (error) { return malformed(error); }
}
const remove = async (path: string, body: unknown) => { await authenticatedApiFetch(path, json('DELETE', body)); };

export const diaryMutationApi = {
  create: (body: { title: string; description?: string | null; startDate?: string | null; endDate?: string | null; clientRequestId: string }) => mutate('/diaries', 'POST', body),
  update: (id: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}`, 'PATCH', body),
  delete: (id: string, body: Record<string, unknown>) => remove(`/diaries/${encodeURIComponent(id)}`, body),
  ensureDay: (id: string, date: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/days/date/${encodeURIComponent(date)}`, 'PUT', body),
  updateDay: (id: string, dayId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/days/${encodeURIComponent(dayId)}`, 'PATCH', body),
  deleteDay: (id: string, dayId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/days/${encodeURIComponent(dayId)}`, 'DELETE', body),
  createTopic: (id: string, dayId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/days/${encodeURIComponent(dayId)}/topics`, 'POST', body),
  updateTopic: (id: string, topicId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/topics/${encodeURIComponent(topicId)}`, 'PATCH', body),
  deleteTopic: (id: string, topicId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/topics/${encodeURIComponent(topicId)}`, 'DELETE', body),
  reorderTopics: (id: string, dayId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/days/${encodeURIComponent(dayId)}/topics/order`, 'PUT', body),
  createObject: (id: string, topicId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/topics/${encodeURIComponent(topicId)}/objects`, 'POST', body),
  updateObject: (id: string, objectId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/objects/${encodeURIComponent(objectId)}`, 'PATCH', body),
  deleteObject: (id: string, objectId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/objects/${encodeURIComponent(objectId)}`, 'DELETE', body),
  reorderObjects: (id: string, topicId: string, body: Record<string, unknown>) => mutate(`/diaries/${encodeURIComponent(id)}/topics/${encodeURIComponent(topicId)}/objects/order`, 'PUT', body),
};
