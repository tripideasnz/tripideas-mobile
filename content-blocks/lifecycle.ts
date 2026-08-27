import type {
  CreateContentBlockInput,
  UpdateContentBlockInput,
} from '@/content-blocks/types';
import {
  addNotebookTextItem,
  deleteNotebookTextItem,
  reorderNotebookItems,
  updateNotebookTextItem,
  updateNotebookBlock,
} from '@/notebooks/api';
import type { NotebookDetail } from '@/notebooks/types';

export function createContentBlock(
  notebookId: string,
  expectedVersion: number,
  position: number,
  input: CreateContentBlockInput
): Promise<NotebookDetail> {
  switch (input.type) {
    case 'text':
      return addNotebookTextItem(
        notebookId,
        expectedVersion,
        input.text ?? '',
        position,
        input.title ?? null
      );
    default:
      throw new Error('objects_v2_page_block_required');
  }
}

export function updateContentBlock(
  notebookId: string,
  blockId: string,
  expectedVersion: number,
  input: UpdateContentBlockInput
): Promise<NotebookDetail> {
  switch (input.type) {
    case 'text':
      return updateNotebookTextItem(
        notebookId,
        blockId,
        expectedVersion,
        {
          title: input.title,
          text: input.text,
        }
      );
    case 'link':
      return updateNotebookBlock(notebookId, blockId, expectedVersion, {
        title: input.title, text: input.text, url: input.url,
      });
  }
}

export function deleteContentBlock(
  notebookId: string,
  blockId: string,
  expectedVersion: number
): Promise<NotebookDetail> {
  return deleteNotebookTextItem(notebookId, blockId, expectedVersion);
}

export function reorderContentBlocks(
  notebookId: string,
  expectedVersion: number,
  blockIds: string[]
): Promise<NotebookDetail> {
  return reorderNotebookItems(notebookId, expectedVersion, blockIds);
}
