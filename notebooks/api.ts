import {
  ApiError,
  authenticatedApiFetch as apiFetch,
} from '@/lib/api-client';
import { parseContentBlock } from '@/content-blocks/registry';
import type {
  CreateNotebookInput,
  NotebookDeletion,
  NotebookDetail,
  NotebookSummary,
  UpdateNotebookInput,
} from '@/notebooks/types';
import type { RichBlockMetadataInput } from '@/content-blocks/types';

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(500, 'malformed_response');
  }
  return value as Record<string, unknown>;
};

const string = (value: unknown): string => {
  if (typeof value !== 'string') throw new ApiError(500, 'malformed_response');
  return value;
};

const nullableString = (value: unknown): string | null => {
  if (value === null) return null;
  return string(value);
};

const integer = (value: unknown): number => {
  if (!Number.isInteger(value)) throw new ApiError(500, 'malformed_response');
  return value as number;
};

export function parseNotebookDetail(value: unknown): NotebookDetail {
  const data = object(value);
  if (!Array.isArray(data.items)) throw new ApiError(500, 'malformed_response');

  return {
    id: string(data.id),
    title: string(data.title),
    description: nullableString(data.description),
    version: integer(data.version),
    createdAt: string(data.createdAt),
    updatedAt: string(data.updatedAt),
    items: data.items
      .map((itemValue) => {
        try {
          return parseContentBlock(itemValue, {
            integer,
            nullableString,
            object,
            string,
          });
        } catch (error) {
          if (error instanceof ApiError) throw error;
          throw new ApiError(500, 'malformed_response');
        }
      })
      .sort((a, b) => a.position - b.position),
  };
}

export function parseNotebookContent(value: unknown): NotebookDetail {
  const detail = parseNotebookDetail(value);
  const data = object(value);
  if (!Array.isArray(data.pages)) throw new ApiError(500, 'malformed_response');
  return {
    ...detail,
    pages: data.pages
      .map((pageValue) => {
        const page = object(pageValue);
        if (!Array.isArray(page.blocks)) {
          throw new ApiError(500, 'malformed_response');
        }
        const title = nullableString(page.title);
        const blocks = page.blocks.map((block) => {
          const raw = object(block);
          return parseContentBlock(
            raw.type === 'text' ? { ...raw, title } : raw,
            { integer, nullableString, object, string }
          );
        }).sort((a, b) => a.position - b.position);
        return {
          id: string(page.id),
          position: integer(page.position),
          title,
          createdAt: string(page.createdAt),
          updatedAt: string(page.updatedAt),
          blocks: blocks.map((block) =>
            block.type === 'text' ? { ...block, title } : block
          ),
        };
      })
      .sort((a, b) => a.position - b.position),
  };
}

function parseNotebookSummary(value: unknown): NotebookSummary {
  const data = object(value);
  return {
    id: string(data.id),
    title: string(data.title),
    description: nullableString(data.description),
    version: integer(data.version),
    itemCount: integer(data.itemCount),
    createdAt: string(data.createdAt),
    updatedAt: string(data.updatedAt),
  };
}

const json = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
});

export async function listNotebooks(): Promise<NotebookSummary[]> {
  const response = object(await apiFetch<unknown>('/notebooks'));
  if (!Array.isArray(response.notebooks)) {
    throw new ApiError(500, 'malformed_response');
  }
  return response.notebooks.map(parseNotebookSummary);
}

export async function createNotebook(
  input: CreateNotebookInput
): Promise<NotebookDetail> {
  return parseNotebookDetail(
    await apiFetch('/notebooks', { method: 'POST', ...json(input) })
  );
}

export async function readNotebook(id: string): Promise<NotebookDetail> {
  return parseNotebookDetail(await apiFetch(`/notebooks/${encodeURIComponent(id)}`));
}

export async function readNotebookContent(id: string): Promise<NotebookDetail> {
  return parseNotebookContent(
    await apiFetch(`/notebooks/${encodeURIComponent(id)}/content`)
  );
}

export async function addNotebookPhotoBlock(input: {
  notebookId: string;
  pageId: string;
  photoAssetId: string;
  clientRequestId: string;
  expectedVersion: number;
  position: number;
}): Promise<NotebookDetail> {
  const {
    notebookId,
    pageId,
    photoAssetId,
    clientRequestId,
    expectedVersion,
    position,
  } = input;
  return parseNotebookContent(
    await apiFetch(
      `/notebooks/${encodeURIComponent(notebookId)}/blocks/photo`,
      {
        method: 'POST',
        ...json({
          pageId,
          photoAssetId,
          clientRequestId,
          expectedVersion,
          position,
        }),
      }
    )
  );
}

export async function addNotebookLinkBlock(input: {
  notebookId: string; pageId: string; url: string; clientRequestId: string;
  expectedVersion: number; position: number;
}): Promise<NotebookDetail> {
  const { notebookId, ...body } = input;
  return parseNotebookContent(await apiFetch(
    `/notebooks/${encodeURIComponent(notebookId)}/blocks/link`,
    { method: 'POST', ...json(body) }
  ));
}

export async function updateNotebookBlock(
  notebookId: string,
  blockId: string,
  expectedVersion: number,
  input: RichBlockMetadataInput & { title?: string | null; text?: string | null; url?: string }
): Promise<NotebookDetail> {
  return parseNotebookContent(await apiFetch(
    `/notebooks/${encodeURIComponent(notebookId)}/blocks/${encodeURIComponent(blockId)}`,
    { method: 'PATCH', ...json({ expectedVersion, ...input }) }
  ));
}

export async function deleteNotebookPhotoBlock(
  notebookId: string,
  blockId: string,
  expectedVersion: number
): Promise<NotebookDetail> {
  return parseNotebookContent(
    await apiFetch(
      `/notebooks/${encodeURIComponent(notebookId)}/blocks/${encodeURIComponent(blockId)}`,
      { method: 'DELETE', ...json({ expectedVersion }) }
    )
  );
}

export async function authorizePhotoRead(
  photoAssetId: string
): Promise<{ method: 'GET'; url: string; expiresAt: string }> {
  const data = object(
    await apiFetch(
      `/photo-assets/${encodeURIComponent(photoAssetId)}/read-authorization`
    )
  );
  if (data.method !== 'GET') throw new ApiError(500, 'malformed_response');
  return {
    method: 'GET',
    url: string(data.url),
    expiresAt: string(data.expiresAt),
  };
}

export async function updateNotebook(
  id: string,
  input: UpdateNotebookInput
): Promise<NotebookDetail> {
  return parseNotebookDetail(
    await apiFetch(`/notebooks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      ...json(input),
    })
  );
}

export async function deleteNotebook(
  id: string,
  expectedVersion: number
): Promise<NotebookDeletion> {
  const data = object(
    await apiFetch(`/notebooks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      ...json({ expectedVersion }),
    })
  );
  if (data.state !== 'deleted') throw new ApiError(500, 'malformed_response');
  return {
    id: string(data.id),
    state: 'deleted',
    deletedAt: string(data.deletedAt),
    version: integer(data.version),
  };
}

export async function addNotebookTextItem(
  notebookId: string,
  expectedVersion: number,
  text: string,
  position: number,
  title?: string | null
): Promise<NotebookDetail> {
  return parseNotebookDetail(
    await apiFetch(`/notebooks/${encodeURIComponent(notebookId)}/items/text`, {
      method: 'POST',
      ...json({ expectedVersion, position, text, title }),
    })
  );
}

export async function updateNotebookTextItem(
  notebookId: string,
  itemId: string,
  expectedVersion: number,
  input: { title?: string | null; text?: string }
): Promise<NotebookDetail> {
  return parseNotebookDetail(
    await apiFetch(
      `/notebooks/${encodeURIComponent(notebookId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'PATCH', ...json({ expectedVersion, ...input }) }
    )
  );
}

export async function deleteNotebookTextItem(
  notebookId: string,
  itemId: string,
  expectedVersion: number
): Promise<NotebookDetail> {
  return parseNotebookDetail(
    await apiFetch(
      `/notebooks/${encodeURIComponent(notebookId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE', ...json({ expectedVersion }) }
    )
  );
}

export async function reorderNotebookItems(
  notebookId: string,
  expectedVersion: number,
  itemIds: string[]
): Promise<NotebookDetail> {
  return parseNotebookDetail(
    await apiFetch(`/notebooks/${encodeURIComponent(notebookId)}/order`, {
      method: 'PUT',
      ...json({ expectedVersion, itemIds }),
    })
  );
}
