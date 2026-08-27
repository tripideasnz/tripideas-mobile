import { orderedContentBlocks } from '@/content-blocks/ordering';
import type {
  ContentBlock,
  ContentPage,
} from '@/content-blocks/types';

/**
 * Compatibility projection for the Phase 1 API, where each text item represents
 * one page. Future APIs can populate multiple blocks without changing renderers.
 */
export function pagesFromContentBlocks(blocks: ContentBlock[]): ContentPage[] {
  return orderedContentBlocks(blocks).map((block) => ({
    id: block.id,
    position: block.position,
    title: block.type === 'text' ? block.title : null,
    blocks: [{ ...block, position: 0, ...(block.type === 'text' ? { role: 'pageBody' as const } : {}) }],
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  }));
}

export function adjacentContentPageId(
  pages: ContentPage[],
  pageId: string,
  offset: -1 | 1
): string | null {
  const ordered = [...pages].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((page) => page.id === pageId);
  return ordered[index + offset]?.id ?? null;
}
