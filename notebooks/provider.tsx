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
import type {
  CreateNotebookInput,
  NotebookDetail,
  NotebookSummary,
  UpdateNotebookInput,
} from '@/notebooks/types';

type NotebookContextValue = {
  createNotebook: (input: CreateNotebookInput) => Promise<NotebookDetail>;
  deleteNotebook: (id: string, expectedVersion: number) => Promise<void>;
  details: Record<string, NotebookDetail>;
  isLoading: boolean;
  listError: NotebookFailure | null;
  loadNotebook: (id: string, refresh?: boolean) => Promise<NotebookDetail | null>;
  mutate: {
    addText: (detail: NotebookDetail, text?: string) => Promise<NotebookDetail>;
    deleteText: (detail: NotebookDetail, itemId: string) => Promise<NotebookDetail>;
    reorder: (detail: NotebookDetail, itemIds: string[]) => Promise<NotebookDetail>;
    updateMetadata: (
      detail: NotebookDetail,
      input: Omit<UpdateNotebookInput, 'expectedVersion'>
    ) => Promise<NotebookDetail>;
    updateText: (
      detail: NotebookDetail,
      itemId: string,
      text: string
    ) => Promise<NotebookDetail>;
  };
  notebooks: NotebookSummary[];
  refresh: () => Promise<void>;
};

const NotebookContext = createContext<NotebookContextValue | null>(null);

function summaryFromDetail(detail: NotebookDetail): NotebookSummary {
  return { ...detail, itemCount: detail.items.length };
}

export function NotebookProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const activeUserIdRef = useRef<string | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [details, setDetails] = useState<Record<string, NotebookDetail>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<NotebookFailure | null>(null);

  const storeDetail = useCallback(async (ownerId: string, detail: NotebookDetail) => {
    if (activeUserIdRef.current !== ownerId) return;
    setDetails((current) => ({ ...current, [detail.id]: detail }));
    setNotebooks((current) => {
      const summary = summaryFromDetail(detail);
      const index = current.findIndex((item) => item.id === detail.id);
      return index < 0
        ? [summary, ...current]
        : current.map((item) => (item.id === detail.id ? summary : item));
    });
    await notebookStorage.setDetail(ownerId, detail);
  }, []);

  const refresh = useCallback(async () => {
    const ownerId = activeUserIdRef.current;
    if (!ownerId) return;
    setIsLoading(true);
    setListError(null);
    try {
      const latest = await listNotebooks();
      if (activeUserIdRef.current !== ownerId) return;
      setNotebooks(latest);
      await notebookStorage.setList(ownerId, latest);
    } catch (error) {
      if (activeUserIdRef.current === ownerId) {
        setListError(classifyNotebookError(error));
      }
    } finally {
      if (activeUserIdRef.current === ownerId) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    activeUserIdRef.current = userId;
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
        setDetails((current) => ({ ...current, [id]: cached }));
        if (!forceRefresh) return cached;
      }

      try {
        const latest = await readNotebook(id);
        await storeDetail(ownerId, latest);
        return latest;
      } catch (error) {
        throw error;
      }
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

  const deleteNotebook = useCallback(async (id: string, expectedVersion: number) => {
    const ownerId = activeUserIdRef.current;
    if (!ownerId) throw new ApiError(401, 'unauthenticated');
    await deleteNotebookRequest(id, expectedVersion);
    if (activeUserIdRef.current !== ownerId) return;
    setNotebooks((current) => current.filter((item) => item.id !== id));
    setDetails((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    await notebookStorage.removeDetail(ownerId, id);
  }, []);

  const authoritativeMutation = useCallback(
    async (request: () => Promise<NotebookDetail>) => {
      const ownerId = activeUserIdRef.current;
      if (!ownerId) throw new ApiError(401, 'unauthenticated');
      const detail = await request();
      await storeDetail(ownerId, detail);
      return detail;
    },
    [storeDetail]
  );

  const mutate = useMemo(
    () => ({
      updateMetadata: (
        detail: NotebookDetail,
        input: Omit<UpdateNotebookInput, 'expectedVersion'>
      ) =>
        authoritativeMutation(() =>
          updateNotebookRequest(detail.id, {
            ...input,
            expectedVersion: detail.version,
          })
        ),
      addText: (detail: NotebookDetail, text = '') =>
        authoritativeMutation(() =>
          addNotebookTextItem(
            detail.id,
            detail.version,
            text,
            detail.items.length
          )
        ),
      updateText: (detail: NotebookDetail, itemId: string, text: string) =>
        authoritativeMutation(() =>
          updateNotebookTextItem(detail.id, itemId, detail.version, text)
        ),
      deleteText: (detail: NotebookDetail, itemId: string) =>
        authoritativeMutation(() =>
          deleteNotebookTextItem(detail.id, itemId, detail.version)
        ),
      reorder: (detail: NotebookDetail, itemIds: string[]) =>
        authoritativeMutation(() =>
          reorderNotebookItems(detail.id, detail.version, itemIds)
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
