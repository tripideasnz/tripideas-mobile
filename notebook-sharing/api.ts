import {
  ApiError,
  authenticatedApiFetch as apiFetch,
} from '@/lib/api-client';
import type {
  NotebookShareCapability,
  NotebookShareCapabilityCreated,
  NotebookShareCapabilityState,
  NotebookShareState,
} from '@/notebook-sharing/types';

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

const state = (value: unknown): NotebookShareCapabilityState => {
  if (value !== 'active' && value !== 'revoked' && value !== 'rotated') {
    throw new ApiError(500, 'malformed_response');
  }
  return value;
};

export function parseShareCapability(value: unknown): NotebookShareCapability {
  const data = object(value);
  return {
    id: string(data.id),
    state: state(data.state),
    expiresAt: nullableString(data.expiresAt),
    createdAt: string(data.createdAt),
    revokedAt: nullableString(data.revokedAt),
    rotatedAt: nullableString(data.rotatedAt),
  };
}

export function parseShareCapabilityCreated(
  value: unknown
): NotebookShareCapabilityCreated {
  const data = object(value);
  if (typeof data.secretUnavailable !== 'boolean') {
    throw new ApiError(500, 'malformed_response');
  }
  return {
    ...parseShareCapability(data),
    url: nullableString(data.url),
    secretUnavailable: data.secretUnavailable,
  };
}

export function parseNotebookShareState(value: unknown): NotebookShareState {
  const data = object(value);
  if (data.share === null) return { share: null };
  const share = object(data.share);
  if (share.state !== 'active' || !Array.isArray(share.capabilities)) {
    throw new ApiError(500, 'malformed_response');
  }
  return {
    share: {
      id: string(share.id),
      state: 'active',
      capabilities: share.capabilities.map(parseShareCapability),
    },
  };
}

const json = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
});

export async function listNotebookShares(
  notebookId: string
): Promise<NotebookShareState> {
  return parseNotebookShareState(
    await apiFetch(`/notebooks/${encodeURIComponent(notebookId)}/shares`)
  );
}

export async function createNotebookShare(
  notebookId: string,
  clientRequestId: string
): Promise<NotebookShareCapabilityCreated> {
  return parseShareCapabilityCreated(
    await apiFetch(
      `/notebooks/${encodeURIComponent(notebookId)}/shares/capabilities`,
      { method: 'POST', ...json({ clientRequestId }) }
    )
  );
}

export async function rotateNotebookShare(
  notebookId: string,
  capabilityId: string,
  clientRequestId: string
): Promise<NotebookShareCapabilityCreated> {
  return parseShareCapabilityCreated(
    await apiFetch(
      `/notebooks/${encodeURIComponent(notebookId)}/shares/capabilities/${encodeURIComponent(capabilityId)}/rotate`,
      { method: 'POST', ...json({ clientRequestId }) }
    )
  );
}

export async function revokeNotebookShare(
  notebookId: string,
  capabilityId: string
): Promise<void> {
  await apiFetch(
    `/notebooks/${encodeURIComponent(notebookId)}/shares/capabilities/${encodeURIComponent(capabilityId)}`,
    { method: 'DELETE' }
  );
}
