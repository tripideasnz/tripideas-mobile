import type {
  ContentBlock,
  TextContentBlock,
} from '@/content-blocks/types';

export type NotebookSummary = {
  id: string;
  title: string;
  description: string | null;
  version: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NotebookTextItem = TextContentBlock;

export type NotebookDetail = {
  id: string;
  title: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: ContentBlock[];
};

export type NotebookDeletion = {
  id: string;
  state: 'deleted';
  deletedAt: string;
  version: number;
};

export type CreateNotebookInput = {
  title: string;
  description?: string | null;
};

export type UpdateNotebookInput = {
  expectedVersion: number;
  title?: string;
  description?: string | null;
};
