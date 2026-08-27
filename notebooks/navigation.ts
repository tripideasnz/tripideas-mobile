import type { Href } from 'expo-router';

type NotebookRouter = {
  back: () => void;
  canGoBack: () => boolean;
  push: (href: Href) => void;
  replace: (href: Href) => void;
};

const NOTEBOOK_LIST_HREF = '/notebooks' as Href;
const SAVED_HREF = '/saved' as Href;

export function backFromNotebookDetail(
  router: Pick<NotebookRouter, 'back' | 'canGoBack' | 'replace'>
): void {
  if (router.canGoBack()) router.back();
  else router.replace(NOTEBOOK_LIST_HREF);
}

export function backFromNotebookList(
  router: Pick<NotebookRouter, 'back' | 'canGoBack' | 'replace'>
): void {
  if (router.canGoBack()) router.back();
  else router.replace(SAVED_HREF);
}

export function openNotebook(
  router: Pick<NotebookRouter, 'push'>,
  notebookId: string
): void {
  router.push(`/notebooks/${notebookId}` as Href);
}

export function openNotebookList(
  router: Pick<NotebookRouter, 'push'>
): void {
  router.push(NOTEBOOK_LIST_HREF);
}
