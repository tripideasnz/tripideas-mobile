export function shouldAdoptAutosaveResponse(
  currentRevision: number,
  savedRevision: number
): boolean {
  return currentRevision === savedRevision;
}
