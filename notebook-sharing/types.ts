export type NotebookShareCapabilityState = 'active' | 'revoked' | 'rotated';

export type NotebookShareCapability = {
  id: string;
  state: NotebookShareCapabilityState;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
};

export type NotebookShareCapabilityCreated = NotebookShareCapability & {
  url: string | null;
  secretUnavailable: boolean;
};

export type NotebookShareState = {
  share: {
    id: string;
    state: 'active';
    capabilities: NotebookShareCapability[];
  } | null;
};
