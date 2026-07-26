export type NotebookSummary = {
  id: string;
  title: string;
  description: string | null;
  version: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NotebookTextItem = {
  id: string;
  type: 'text';
  position: number;
  title: string | null;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type NotebookDetail = {
  id: string;
  title: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: NotebookTextItem[];
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
