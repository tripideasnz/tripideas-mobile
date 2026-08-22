import type { DiarySourceCandidate } from '@/diaries/types';

type CandidateInput = Omit<DiarySourceCandidate, 'presentation'> & {
  presentation?: Record<string, unknown>;
};

export function normalizeDiarySourceCandidate(input: CandidateInput): DiarySourceCandidate {
  return { ...input, presentation: input.presentation ?? {} };
}

export function notebookBlockCandidate(input: Omit<CandidateInput, 'sourceKind' | 'contentOrigin'>) {
  return normalizeDiarySourceCandidate({ ...input, sourceKind: 'NOTEBOOK_BLOCK', contentOrigin: 'USER_OWNED' });
}

export function userTripNoteCandidate(input: Omit<CandidateInput, 'sourceKind' | 'contentOrigin'>) {
  return normalizeDiarySourceCandidate({ ...input, sourceKind: 'ITINERARY_ENTRY', contentOrigin: 'USER_OWNED' });
}

export function editorialPlaceCandidate(input: Omit<CandidateInput, 'sourceKind' | 'contentOrigin'>) {
  return normalizeDiarySourceCandidate({ ...input, sourceKind: 'EDITORIAL_PLACE', contentOrigin: 'TRIPIDEAS_SUPPLIED' });
}
