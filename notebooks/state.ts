import type { NotebookDetail, NotebookSummary } from '@/notebooks/types';

export function summaryFromNotebookDetail(detail: NotebookDetail): NotebookSummary {
  return { ...detail, itemCount: detail.items.length };
}

export function preferNewerDetail(
  current: NotebookDetail | undefined,
  incoming: NotebookDetail
): NotebookDetail {
  return current && current.version > incoming.version ? current : incoming;
}

export function mergeNotebookSummaries(
  incoming: NotebookSummary[],
  details: Record<string, NotebookDetail>
): NotebookSummary[] {
  return incoming.map((summary) => {
    const detail = details[summary.id];
    return detail && detail.version > summary.version
      ? summaryFromNotebookDetail(detail)
      : summary;
  });
}

export function createKeyedMutationQueue() {
  const tails = new Map<string, Promise<unknown>>();

  return async function enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    tails.set(key, current);
    try {
      return await current;
    } finally {
      if (tails.get(key) === current) tails.delete(key);
    }
  };
}
