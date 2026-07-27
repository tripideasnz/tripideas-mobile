import type { ContentBlock } from '@/content-blocks/types';

export function orderedContentBlocks<TBlock extends ContentBlock>(
  blocks: TBlock[]
): TBlock[] {
  return [...blocks].sort((a, b) => a.position - b.position);
}

export function adjacentContentBlockId(
  blocks: ContentBlock[],
  blockId: string,
  offset: -1 | 1
): string | null {
  const ordered = orderedContentBlocks(blocks);
  const index = ordered.findIndex((block) => block.id === blockId);
  return ordered[index + offset]?.id ?? null;
}

export function moveContentBlockIds(
  blocks: ContentBlock[],
  blockId: string,
  offset: -1 | 1
): string[] | null {
  const ordered = orderedContentBlocks(blocks);
  const index = ordered.findIndex((block) => block.id === blockId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ordered.length) return null;
  const ids = ordered.map((block) => block.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
