import { ApiError, authenticatedApiFetch } from '@/lib/api-client';
import { DiaryApiParseError, parseDiaryDetail, parseDiaryList } from '@/diaries/api-model';

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
