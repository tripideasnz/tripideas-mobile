import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSession } from '@/auth/provider';
import {
  createContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
  updateContentBlock,
} from '@/content-blocks/lifecycle';
import type {
  CreateContentBlockInput,
  UpdateContentBlockInput,
} from '@/content-blocks/types';
import { ApiError } from '@/lib/api-client';
import {
  classifyNotebookError,
  type NotebookFailure,
} from '@/notebooks/errors';
import {
  createNotebook as createNotebookRequest,
  deleteNotebook as deleteNotebookRequest,
  listNotebooks,
  readNotebook,
  readNotebookContent,
  addNotebookPhotoBlock,
  addNotebookLinkBlock,
  addNotebookTextBlock,
  addNotebookPlaceBlock,
  addNotebookPinBlock,
  reorderNotebookBlocks,
  updateNotebookBlock,
  deleteNotebookBlock,
  updateNotebook as updateNotebookRequest,
} from '@/notebooks/api';
import { notebookStorage } from '@/notebooks/storage';
import {
  createKeyedMutationQueue,
  mergeNotebookSummaries,
  preferNewerDetail,
  summaryFromNotebookDetail,
} from '@/notebooks/state';
import type {
  CreateNotebookInput,
  NotebookDetail,
  NotebookSummary,
  UpdateNotebookInput,
} from '@/notebooks/types';
import type { RichBlockMetadataInput } from '@/content-blocks/types';

type NotebookContextValue = {
  createNotebook: (input: CreateNotebookInput) => Promise<NotebookDetail>;
  deleteNotebook: (id: string) => Promise<void>;
  details: Record<string, NotebookDetail>;
  isLoading: boolean;
  listError: NotebookFailure | null;
  loadNotebook: (id: string, refresh?: boolean) => Promise<NotebookDetail | null>;
  mutate: {
    addBlock: (
      id: string,
      input: CreateContentBlockInput
    ) => Promise<NotebookDetail>;
    deleteBlock: (id: string, blockId: string) => Promise<NotebookDetail>;
    reorderBlocks: (id: string, blockIds: string[]) => Promise<NotebookDetail>;
    updateMetadata: (
      id: string,
      input: Omit<UpdateNotebookInput, 'expectedVersion'>
    ) => Promise<NotebookDetail>;
    updateBlock: (
      id: string,
      blockId: string,
      input: UpdateContentBlockInput
    ) => Promise<NotebookDetail>;
    addPhotoBlock: (input: {
      id: string;
      pageId: string;
      photoAssetId: string;
      clientRequestId: string;
    }) => Promise<NotebookDetail>;
    deletePhotoBlock: (id: string, blockId: string) => Promise<NotebookDetail>;
    deleteObjectBlock: (id: string, blockId: string) => Promise<NotebookDetail>;
    addLinkBlock: (input: { id: string; pageId: string; url: string; title?: string | null; text?: string | null; clientRequestId: string }) => Promise<NotebookDetail>;
    addTextBlock: (input: { id: string; pageId: string; title?: string | null; text?: string; clientRequestId: string }) => Promise<NotebookDetail>;
    addPlaceBlock: (input: { id: string; pageId: string; titleSnapshot: string; reference: { kind: 'editorial'; editorialPlaceId: string } | { kind: 'personal'; personalPlaceCardId: string }; locationSnapshot?: { latitude: number; longitude: number; accuracyMeters?: number | null } | null; clientRequestId: string }) => Promise<NotebookDetail>;
    addPinBlock: (input: { id: string; pageId: string; title?: string | null; location: { latitude: number; longitude: number; source: 'PIN_NOW' | 'MAP_SELECTED'; accuracyMeters?: number | null }; clientRequestId: string }) => Promise<NotebookDetail>;
    reorderPageBlocks: (id: string, pageId: string, blockIds: string[]) => Promise<NotebookDetail>;
    updateRichBlock: (id: string, blockId: string, input: RichBlockMetadataInput & { title?: string | null; text?: string | null; url?: string }) => Promise<NotebookDetail>;
  };
  notebooks: NotebookSummary[];
  refresh: () => Promise<void>;
};

const NotebookContext = createContext<NotebookContextValue | null>(null);

export function NotebookProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const activeUserIdRef = useRef<string | null>(null);
  const detailsRef = useRef<Record<string, NotebookDetail>>({});
  const enqueueMutation = useRef(createKeyedMutationQueue()).current;
  const listRequestRef = useRef(0);
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [details, setDetails] = useState<Record<string, NotebookDetail>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<NotebookFailure | null>(null);

  const storeDetail = useCallback(async (
    ownerId: string,
    incoming: NotebookDetail
  ): Promise<NotebookDetail> => {
    if (activeUserIdRef.current !== ownerId) return incoming;
    const detail = preferNewerDetail(detailsRef.current[incoming.id], incoming);
    detailsRef.current = { ...detailsRef.current, [detail.id]: detail };
    setDetails(detailsRef.current);
    setNotebooks((current) => {
      const summary = summaryFromNotebookDetail(detail);
      const index = current.findIndex((item) => item.id === detail.id);
      return index < 0
        ? [summary, ...current]
        : current.map((item) =>
            item.id === detail.id && item.version <= detail.version ? summary : item
          );
    });
    await notebookStorage.setDetail(ownerId, detail);
    const current = detailsRef.current[detail.id];
    if (current.version > detail.version) {
      await notebookStorage.setDetail(ownerId, current);
      return current;
    }
    return detail;
  }, []);

  const refresh = useCallback(async () => {
    const ownerId = activeUserIdRef.current;
    if (!ownerId) return;
    const requestId = ++listRequestRef.current;
    setIsLoading(true);
    setListError(null);
    try {
      const latest = await listNotebooks();
      if (
        activeUserIdRef.current !== ownerId ||
        requestId !== listRequestRef.current
      ) return;
      const merged = mergeNotebookSummaries(latest, detailsRef.current);
      setNotebooks(merged);
      await notebookStorage.setList(ownerId, merged);
    } catch (error) {
      if (
        activeUserIdRef.current === ownerId &&
        requestId === listRequestRef.current
      ) {
        setListError(classifyNotebookError(error));
      }
    } finally {
      if (activeUserIdRef.current === ownerId) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    activeUserIdRef.current = userId;
    detailsRef.current = {};
    setDetails({});
    setNotebooks([]);
    setListError(null);

    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    notebookStorage
      .getList(userId)
      .then((cached) => {
        if (mounted && activeUserIdRef.current === userId) setNotebooks(cached);
      })
      .finally(() => {
        if (mounted && activeUserIdRef.current === userId) void refresh();
      });

    return () => {
      mounted = false;
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (userId) {
      void notebookStorage.setList(userId, notebooks);
    }
  }, [notebooks, userId]);

  const loadNotebook = useCallback(
    async (id: string, forceRefresh = true) => {
      const ownerId = activeUserIdRef.current;
      if (!ownerId) return null;

      const cached = await notebookStorage.getDetail(ownerId, id);
      if (cached && activeUserIdRef.current === ownerId) {
        const stored = await storeDetail(ownerId, cached);
        if (!forceRefresh) return stored;
      }

      const latest = await readNotebookContent(id);
      return storeDetail(ownerId, latest);
    },
    [storeDetail]
  );

  const createNotebook = useCallback(
    async (input: CreateNotebookInput) => {
      const ownerId = activeUserIdRef.current;
      if (!ownerId) throw new ApiError(401, 'unauthenticated');
      const detail = await createNotebookRequest(input);
      await storeDetail(ownerId, detail);
      return detail;
    },
    [storeDetail]
  );

  const currentDetail = useCallback(async (
    ownerId: string,
    id: string
  ): Promise<NotebookDetail> => {
    const current = detailsRef.current[id];
    if (current) return current;
    return storeDetail(ownerId, await readNotebookContent(id));
  }, [storeDetail]);

  const deleteNotebook = useCallback(async (id: string) => {
    const ownerId = activeUserIdRef.current;
    if (!ownerId) throw new ApiError(401, 'unauthenticated');
    await enqueueMutation(id, async () => {
      const latest = await storeDetail(ownerId, await readNotebook(id));
      await deleteNotebookRequest(id, latest.version);
      if (activeUserIdRef.current !== ownerId) return;
      setNotebooks((current) => current.filter((item) => item.id !== id));
      const next = { ...detailsRef.current };
      delete next[id];
      detailsRef.current = next;
      setDetails(next);
      await notebookStorage.removeDetail(ownerId, id);
    });
  }, [enqueueMutation, storeDetail]);

  const authoritativeMutation = useCallback(
    async (
      id: string,
      request: (detail: NotebookDetail) => Promise<NotebookDetail>
    ) => {
      const ownerId = activeUserIdRef.current;
      if (!ownerId) throw new ApiError(401, 'unauthenticated');
      return enqueueMutation(id, async () => {
        const detail = await currentDetail(ownerId, id);
        await request(detail);
        return storeDetail(ownerId, await readNotebookContent(id));
      });
    },
    [currentDetail, enqueueMutation, storeDetail]
  );

  const mutate = useMemo(
    () => ({
      updateMetadata: (
        id: string,
        input: Omit<UpdateNotebookInput, 'expectedVersion'>
      ) =>
        authoritativeMutation(id, (detail) =>
          updateNotebookRequest(id, {
            ...input,
            expectedVersion: detail.version,
          })
        ),
      addBlock: (id: string, input: CreateContentBlockInput) =>
        authoritativeMutation(id, (detail) =>
          createContentBlock(
            id,
            detail.version,
            detail.items.length,
            input
          )
        ),
      addPhotoBlock: (input: {
        id: string;
        pageId: string;
        photoAssetId: string;
        clientRequestId: string;
      }) =>
        authoritativeMutation(input.id, (detail) => {
          const page = detail.pages?.find(
            (candidate) => candidate.id === input.pageId
          );
          if (!page) throw new ApiError(404, 'not_found');
          return addNotebookPhotoBlock({
            notebookId: input.id,
            pageId: input.pageId,
            photoAssetId: input.photoAssetId,
            clientRequestId: input.clientRequestId,
            expectedVersion: detail.version,
            position: page.blocks.length,
          });
        }),
      addLinkBlock: (input: { id: string; pageId: string; url: string; title?: string | null; text?: string | null; clientRequestId: string }) => {
        const ownerId = activeUserIdRef.current;
        if (!ownerId) return Promise.reject(new ApiError(401, 'unauthenticated'));
        const matchesRequest = (detail: NotebookDetail) => detail.pages
          ?.some((page) => page.id === input.pageId && page.blocks.some((block) =>
            block.type === 'link' && block.clientRequestId === input.clientRequestId &&
            block.url === input.url && block.title === (input.title ?? null) &&
            block.text === (input.text ?? null)));
        return enqueueMutation(input.id, async () => {
          const detail = await currentDetail(ownerId, input.id);
          if (matchesRequest(detail)) return detail;
          const page = detail.pages?.find((candidate) => candidate.id === input.pageId);
          if (!page) throw new ApiError(404, 'not_found');
          try {
            await addNotebookLinkBlock({ notebookId: input.id, pageId: input.pageId,
              url: input.url, title: input.title ?? null, text: input.text ?? null,
              clientRequestId: input.clientRequestId,
              expectedVersion: detail.version, position: page.blocks.length });
          } catch (error) {
            try {
              const refreshed = await storeDetail(ownerId, await readNotebookContent(input.id));
              if (matchesRequest(refreshed)) return refreshed;
            } catch { /* preserve the original create failure */ }
            throw error;
          }
          return storeDetail(ownerId, await readNotebookContent(input.id));
        });
      },
      addTextBlock: (input: { id: string; pageId: string; title?: string | null; text?: string; clientRequestId: string }) =>
        authoritativeMutation(input.id, (detail) => {
          const page = detail.pages?.find((candidate) => candidate.id === input.pageId);
          if (!page) throw new ApiError(404, 'not_found');
          return addNotebookTextBlock({ notebookId: input.id, pageId: input.pageId,
            clientRequestId: input.clientRequestId, title: input.title ?? null,
            text: input.text ?? '', expectedVersion: detail.version, position: page.blocks.length });
        }),
      addPlaceBlock: (input: { id: string; pageId: string; titleSnapshot: string; reference: { kind: 'editorial'; editorialPlaceId: string } | { kind: 'personal'; personalPlaceCardId: string }; locationSnapshot?: { latitude: number; longitude: number; accuracyMeters?: number | null } | null; clientRequestId: string }) =>
        authoritativeMutation(input.id, (detail) => {
          const page = detail.pages?.find((candidate) => candidate.id === input.pageId);
          if (!page) throw new ApiError(404, 'not_found');
          return addNotebookPlaceBlock({ notebookId: input.id, pageId: input.pageId,
            expectedVersion: detail.version, position: page.blocks.length,
            clientRequestId: input.clientRequestId, titleSnapshot: input.titleSnapshot,
            reference: input.reference, locationSnapshot: input.locationSnapshot });
        }),
      addPinBlock: (input: { id: string; pageId: string; title?: string | null; location: { latitude: number; longitude: number; source: 'PIN_NOW' | 'MAP_SELECTED'; accuracyMeters?: number | null }; clientRequestId: string }) =>
        authoritativeMutation(input.id, (detail) => {
          const page = detail.pages?.find((candidate) => candidate.id === input.pageId);
          if (!page) throw new ApiError(404, 'not_found');
          return addNotebookPinBlock({ notebookId: input.id, pageId: input.pageId,
            expectedVersion: detail.version, position: page.blocks.length,
            clientRequestId: input.clientRequestId, title: input.title,
            location: input.location });
        }),
      updateRichBlock: (id: string, blockId: string, input: RichBlockMetadataInput & { title?: string | null; text?: string | null; url?: string }) =>
        authoritativeMutation(id, (detail) => updateNotebookBlock(id, blockId, detail.version, input)),
      deletePhotoBlock: (id: string, blockId: string) =>
        authoritativeMutation(id, (detail) =>
          deleteNotebookBlock(id, blockId, detail.version)
        ),
      deleteObjectBlock: (id: string, blockId: string) =>
        authoritativeMutation(id, (detail) => deleteNotebookBlock(id, blockId, detail.version)),
      updateBlock: (
        id: string,
        blockId: string,
        input: UpdateContentBlockInput
      ) =>
        authoritativeMutation(id, (detail) =>
          updateContentBlock(id, blockId, detail.version, input)
        ),
      deleteBlock: (id: string, blockId: string) =>
        authoritativeMutation(id, (detail) =>
          deleteContentBlock(id, blockId, detail.version)
        ),
      reorderBlocks: (id: string, blockIds: string[]) =>
        authoritativeMutation(id, (detail) =>
          reorderContentBlocks(id, detail.version, blockIds)
        ),
      reorderPageBlocks: (id: string, pageId: string, blockIds: string[]) =>
        authoritativeMutation(id, (detail) =>
          reorderNotebookBlocks(id, pageId, detail.version, blockIds)
        ),
    }),
    [authoritativeMutation, currentDetail, enqueueMutation, storeDetail]
  );

  const value = useMemo(
    () => ({
      createNotebook,
      deleteNotebook,
      details,
      isLoading,
      listError,
      loadNotebook,
      mutate,
      notebooks,
      refresh,
    }),
    [
      createNotebook,
      deleteNotebook,
      details,
      isLoading,
      listError,
      loadNotebook,
      mutate,
      notebooks,
      refresh,
    ]
  );

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}

export function useNotebooks(): NotebookContextValue {
  const context = useContext(NotebookContext);
  if (!context) throw new Error('useNotebooks must be used inside NotebookProvider.');
  return context;
}
