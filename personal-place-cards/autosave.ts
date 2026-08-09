export const PERSONAL_PLACE_AUTOSAVE_DELAY_MS = 650;

export function shouldAdoptPersonalPlaceAutosave(
  currentRevision: number,
  savedRevision: number
) {
  return currentRevision === savedRevision;
}

export function reconcilePersonalPlaceAutosave(
  serverValue: string,
  localValue: string,
  currentRevision: number,
  savedRevision: number
) {
  return shouldAdoptPersonalPlaceAutosave(currentRevision, savedRevision)
    ? serverValue
    : localValue;
}
