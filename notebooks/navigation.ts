import type { Href } from 'expo-router';

type NotebookRouter = {
  dismissTo: (href: Href) => void;
  push: (href: Href) => void;
};

const NOTEBOOK_LIST_HREF = '/notebooks' as Href;
const SAVED_HREF = '/saved' as Href;

export function backFromNotebookDetail(
  router: Pick<NotebookRouter, 'dismissTo'>
): void {
  router.dismissTo(NOTEBOOK_LIST_HREF);
}

export function backFromNotebookList(
  router: Pick<NotebookRouter, 'dismissTo'>
): void {
  router.dismissTo(SAVED_HREF);
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
