export type ContentBlockBase<TType extends string> = {
  id: string;
  type: TType;
  position: number;
  createdAt: string;
  updatedAt: string;
  event?: NotebookEvent | null;
  isImportant?: boolean;
  location?: NotebookBlockLocation | null;
};

export type NotebookEvent =
  | { precision: 'DATE'; date: string }
  | { precision: 'DATETIME'; dateTime: string; timeZone: string };

export type NotebookBlockLocation = {
  latitude: number;
  longitude: number;
  source: 'PIN_NOW' | 'MAP_SELECTED' | 'PHOTO_METADATA' | 'PLACE_ASSOCIATION' | 'USER_CONFIRMED';
  accuracyMeters: number | null;
};

export type TextContentBlock = ContentBlockBase<'text'> & {
  title: string | null;
  text: string;
};

export type PhotoContentBlock = ContentBlockBase<'photo'> & {
  photoAssetId: string;
  clientRequestId: string;
};

export type LinkContentBlock = ContentBlockBase<'link'> & {
  url: string;
  title: string | null;
  text: string | null;
  clientRequestId: string;
};

export type ContentBlock = TextContentBlock | PhotoContentBlock | LinkContentBlock;

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
    }
  | {
      type: 'link'; title?: string | null; text?: string | null; url?: string;
    };

export type RichBlockMetadataInput = {
  event?: NotebookEvent | null;
  isImportant?: boolean;
  location?: Omit<NotebookBlockLocation, 'source'> & { source: 'PIN_NOW' | 'MAP_SELECTED' } | null;
};
