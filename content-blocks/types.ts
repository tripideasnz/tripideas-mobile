export type ContentBlockBase<TType extends string> = {
  id: string;
  type: TType;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type TextContentBlock = ContentBlockBase<'text'> & {
  title: string | null;
  text: string;
};

export type PhotoContentBlock = ContentBlockBase<'photo'> & {
  photoAssetId: string;
  clientRequestId: string;
};

export type ContentBlock = TextContentBlock | PhotoContentBlock;

export type ContentPage = {
  id: string;
  position: number;
  title: string | null;
  blocks: ContentBlock[];
  createdAt: string;
  updatedAt: string;
};

export type CreateContentBlockInput =
  | {
      type: 'text';
      title?: string | null;
      text?: string;
    };

export type UpdateContentBlockInput =
  | {
      type: 'text';
      title?: string | null;
      text?: string;
    };
