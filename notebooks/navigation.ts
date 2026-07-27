import type { Href } from 'expo-router';

export type NotebookNavigationRoute = {
  key?: string;
  name: string;
};

export type NotebookNavigationState = {
  index?: number;
  routes: NotebookNavigationRoute[];
};

type NotebookRouter = {
  back: () => void;
  canGoBack: () => boolean;
  navigate: (href: Href) => void;
  replace: (href: Href) => void;
};

const NOTEBOOK_LIST_ROUTE = 'notebooks/index';
const NOTEBOOK_DETAIL_ROUTE = 'notebooks/[notebookId]';
const NOTEBOOK_LIST_HREF = '/notebooks' as Href;

export function hasNotebookListHistory(
  state: NotebookNavigationState
): boolean {
  const currentIndex = state.index ?? state.routes.length - 1;
  if (currentIndex < 1) return false;

  const current = state.routes[currentIndex];
  const previous = state.routes[currentIndex - 1];
  return (
    current?.name === NOTEBOOK_DETAIL_ROUTE &&
    previous?.name === NOTEBOOK_LIST_ROUTE &&
    current.key !== previous.key
  );
}

export function backFromNotebook(
  router: Pick<NotebookRouter, 'back' | 'canGoBack' | 'replace'>,
  state: NotebookNavigationState
): 'back' | 'replace' {
  if (router.canGoBack() && hasNotebookListHistory(state)) {
    router.back();
    return 'back';
  }

  router.replace(NOTEBOOK_LIST_HREF);
  return 'replace';
}

export function openNotebook(
  router: Pick<NotebookRouter, 'navigate'>,
  notebookId: string
): void {
  router.navigate(`/notebooks/${notebookId}` as Href);
}

export function openNotebookList(
  router: Pick<NotebookRouter, 'navigate'>
): void {
  router.navigate(NOTEBOOK_LIST_HREF);
}
