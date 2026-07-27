import type { ReactElement } from 'react';

import type {
  ContentBlock,
  TextContentBlock,
} from '@/content-blocks/types';

export type ContentBlockRenderers = {
  text: (block: TextContentBlock, index: number) => ReactElement;
};

export function renderContentBlock(
  block: ContentBlock,
  index: number,
  renderers: ContentBlockRenderers
): ReactElement {
  switch (block.type) {
    case 'text':
      return renderers.text(block, index);
  }
}
