export function shouldAdoptAutosaveResponse(
  currentRevision: number,
  savedRevision: number
): boolean {
  return currentRevision === savedRevision;
}

export function reconcileAutosaveDraft(
  serverValue: string,
  localValue: string,
  currentRevision: number,
  savedRevision: number,
  reset = false
): string {
  return reset || shouldAdoptAutosaveResponse(currentRevision, savedRevision)
    ? serverValue
    : localValue;
}

export async function retryNotebookConflict<T>(
  reloadLatest: () => Promise<unknown>,
  retryOnce: () => Promise<T>
): Promise<T> {
  await reloadLatest();
  return retryOnce();
}
