import type {
  ContentBlock,
  TextContentBlock,
  PhotoContentBlock,
} from '@/content-blocks/types';

export type ContentBlockReaders = {
  integer: (value: unknown) => number;
  nullableString: (value: unknown) => string | null;
  object: (value: unknown) => Record<string, unknown>;
  string: (value: unknown) => string;
};

type ContentBlockDefinition<TBlock extends ContentBlock> = {
  parse: (
    value: Record<string, unknown>,
    readers: ContentBlockReaders
  ) => TBlock;
  type: TBlock['type'];
};

const textBlockDefinition: ContentBlockDefinition<TextContentBlock> = {
  type: 'text',
  parse: (block, readers) => ({
    id: readers.string(block.id),
    type: 'text',
    position: readers.integer(block.position),
    title: readers.nullableString(block.title),
    text: readers.string(block.text),
    createdAt: readers.string(block.createdAt),
    updatedAt: readers.string(block.updatedAt),
  }),
};

const photoBlockDefinition: ContentBlockDefinition<PhotoContentBlock> = {
  type: 'photo',
  parse: (block, readers) => ({
    id: readers.string(block.id),
    type: 'photo',
    position: readers.integer(block.position),
    photoAssetId: readers.string(block.photoAssetId),
    clientRequestId: readers.string(block.clientRequestId),
    createdAt: readers.string(block.createdAt),
    updatedAt: readers.string(block.updatedAt),
  }),
};

const definitions = {
  text: textBlockDefinition,
  photo: photoBlockDefinition,
} satisfies Record<ContentBlock['type'], ContentBlockDefinition<ContentBlock>>;

export function contentBlockDefinition(
  type: ContentBlock['type']
): ContentBlockDefinition<ContentBlock> {
  return definitions[type];
}

export function parseContentBlock(
  value: unknown,
  readers: ContentBlockReaders
): ContentBlock {
  const block = readers.object(value);
  if (block.type !== 'text' && block.type !== 'photo') {
    throw new Error('unsupported_content_block');
  }
  return contentBlockDefinition(block.type).parse(block, readers);
}
