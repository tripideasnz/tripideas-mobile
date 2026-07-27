import {
  adjacentContentBlockId,
  moveContentBlockIds,
  orderedContentBlocks,
} from '@/content-blocks/ordering';
import type { ContentBlock } from '@/content-blocks/types';

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

export function notebookBlockScrollOffset(sectionY: number, blockY: number): number {
  return Math.max(0, sectionY + blockY - 16);
}

export function adjacentNotebookItemId(
  items: ContentBlock[],
  itemId: string,
  offset: -1 | 1
): string | null {
  return adjacentContentBlockId(items, itemId, offset);
}

export function moveNotebookItemIds(
  items: ContentBlock[],
  itemId: string,
  offset: -1 | 1
): string[] | null {
  return moveContentBlockIds(items, itemId, offset);
}

export const orderedNotebookItems = orderedContentBlocks;
