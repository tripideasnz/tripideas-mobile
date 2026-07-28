import type { ReactElement } from 'react';

import type {
  ContentBlock,
  TextContentBlock,
  PhotoContentBlock,
} from '@/content-blocks/types';

export type ContentBlockRenderers = {
  text: (block: TextContentBlock, index: number) => ReactElement;
  photo: (block: PhotoContentBlock, index: number) => ReactElement;
};

export function renderContentBlock(
  block: ContentBlock,
  index: number,
  renderers: ContentBlockRenderers
): ReactElement {
  switch (block.type) {
    case 'text':
      return renderers.text(block, index);
    case 'photo':
      return renderers.photo(block, index);
  }
}
