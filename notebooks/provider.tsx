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
import { ApiError } from '@/lib/api-client';
import {
  classifyNotebookError,
  type NotebookFailure,
} from '@/notebooks/errors';
import {
  addNotebookTextItem,
  createNotebook as createNotebookRequest,
  deleteNotebook as deleteNotebookRequest,
  deleteNotebookTextItem,
  listNotebooks,
  readNotebook,
  reorderNotebookItems,
  updateNotebook as updateNotebookRequest,
  updateNotebookTextItem,
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

type NotebookContextValue = {
  createNotebook: (input: CreateNotebookInput) => Promise<NotebookDetail>;
  deleteNotebook: (id: string) => Promise<void>;
  details: Record<string, NotebookDetail>;
  isLoading: boolean;
  listError: NotebookFailure | null;
  loadNotebook: (id: string, refresh?: boolean) => Promise<NotebookDetail | null>;
  mutate: {
    addText: (id: string, text?: string, title?: string | null) => Promise<NotebookDetail>;
    deleteText: (id: string, itemId: string) => Promise<NotebookDetail>;
    reorder: (id: string, itemIds: string[]) => Promise<NotebookDetail>;
    updateMetadata: (
      id: string,
      input: Omit<UpdateNotebookInput, 'expectedVersion'>
    ) => Promise<NotebookDetail>;
    updateText: (
      id: string,
      itemId: string,
      input: { title?: string | null; text?: string }
    ) => Promise<NotebookDetail>;
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

      const latest = await readNotebook(id);
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
    return storeDetail(ownerId, await readNotebook(id));
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
        return storeDetail(ownerId, await request(detail));
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
      addText: (id: string, text = '', title: string | null = null) =>
        authoritativeMutation(id, (detail) =>
          addNotebookTextItem(
            id,
            detail.version,
            text,
            detail.items.length,
            title
          )
        ),
      updateText: (
        id: string,
        itemId: string,
        input: { title?: string | null; text?: string }
      ) =>
        authoritativeMutation(id, (detail) =>
          updateNotebookTextItem(id, itemId, detail.version, input)
        ),
      deleteText: (id: string, itemId: string) =>
        authoritativeMutation(id, (detail) =>
          deleteNotebookTextItem(id, itemId, detail.version)
        ),
      reorder: (id: string, itemIds: string[]) =>
        authoritativeMutation(id, (detail) =>
          reorderNotebookItems(id, detail.version, itemIds)
        ),
    }),
    [authoritativeMutation]
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
