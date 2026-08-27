import type { ContentBlock, PhotoContentBlock } from '@/content-blocks/types';

export type PresentedNotebookBlock =
  | { kind: 'object'; block: Exclude<ContentBlock, PhotoContentBlock> }
  | { kind: 'photos'; blocks: PhotoContentBlock[] };

export function groupContiguousNotebookPhotos(blocks: ContentBlock[]): PresentedNotebookBlock[] {
  const groups: PresentedNotebookBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'photo') {
      const previous = groups.at(-1);
      if (previous?.kind === 'photos') previous.blocks.push(block);
      else groups.push({ kind: 'photos', blocks: [block] });
    } else groups.push({ kind: 'object', block });
  }
  return groups;
}

export function moveContiguousNotebookBlockIds(blocks: ContentBlock[], movingIds: string[], offset: -1 | 1): string[] | null {
  const orderedIds = [...blocks].sort((left, right) => left.position - right.position).map(({ id }) => id);
  const moving = new Set(movingIds);
  const first = orderedIds.findIndex((id) => moving.has(id));
  const last = orderedIds.findLastIndex((id) => moving.has(id));
  if (first < 0 || last < first || last - first + 1 !== movingIds.length) return null;
  if (offset === -1) {
    if (first === 0) return null;
    return [...orderedIds.slice(0, first - 1), ...orderedIds.slice(first, last + 1), orderedIds[first - 1], ...orderedIds.slice(last + 1)];
  }
  if (last === orderedIds.length - 1) return null;
  return [...orderedIds.slice(0, first), orderedIds[last + 1], ...orderedIds.slice(first, last + 1), ...orderedIds.slice(last + 2)];
}
