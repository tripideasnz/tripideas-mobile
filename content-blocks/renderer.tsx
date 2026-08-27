import type { ReactElement } from 'react';

import type {
  ContentBlock,
  TextContentBlock,
  PhotoContentBlock,
  LinkContentBlock,
  PlaceContentBlock,
  PinContentBlock,
} from '@/content-blocks/types';

export type ContentBlockRenderers = {
  text: (block: TextContentBlock, index: number) => ReactElement;
  photo: (block: PhotoContentBlock, index: number) => ReactElement;
  link: (block: LinkContentBlock, index: number) => ReactElement;
  place: (block: PlaceContentBlock, index: number) => ReactElement;
  pin: (block: PinContentBlock, index: number) => ReactElement;
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
    case 'link':
      return renderers.link(block, index);
    case 'place':
      return renderers.place(block, index);
    case 'pin':
      return renderers.pin(block, index);
  }
}
