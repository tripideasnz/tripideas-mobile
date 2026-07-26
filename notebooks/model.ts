import type { NotebookTextItem } from '@/notebooks/types';

export type NotebookMetadataValidation =
  | { valid: true; title: string; description: string | null }
  | { valid: false; message: string };

export function validateNotebookMetadata(
  title: string,
  description: string
): NotebookMetadataValidation {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return { valid: false, message: 'Add a title for your Notebook.' };
  }
  if (trimmedTitle.length > 200 || description.length > 10_000) {
    return {
      valid: false,
      message: 'Keep the title under 200 and description under 10,000 characters.',
    };
  }
  return {
    valid: true,
    title: trimmedTitle,
    description: description.trim() ? description : null,
  };
}

export function orderedNotebookItems(items: NotebookTextItem[]): NotebookTextItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

export function notebookBlockScrollOffset(sectionY: number, blockY: number): number {
  return Math.max(0, sectionY + blockY - 16);
}

export function adjacentNotebookItemId(
  items: NotebookTextItem[],
  itemId: string,
  offset: -1 | 1
): string | null {
  const ordered = orderedNotebookItems(items);
  const index = ordered.findIndex((item) => item.id === itemId);
  return ordered[index + offset]?.id ?? null;
}

export function moveNotebookItemIds(
  items: NotebookTextItem[],
  itemId: string,
  offset: -1 | 1
): string[] | null {
  const ordered = orderedNotebookItems(items);
  const index = ordered.findIndex((item) => item.id === itemId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ordered.length) return null;
  const ids = ordered.map((item) => item.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
