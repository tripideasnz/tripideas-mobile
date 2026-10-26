// Opening an editorial Place from the Map, and returning from a Place.
//
// Every Map entry point (marker label, peek-sheet thumbnail, full Place list) goes
// through openPlaceFromMap, so the same Place route opens with the same origin,
// and rapid repeat taps cannot push the screen twice. Place is a root-stack
// route, so returning is an ordinary pop (see backFromPlace).

import type { Href } from 'expo-router';

/** Ignores repeat actions for the same key inside a short window. */
export function createNavigationGuard({
  now = Date.now,
  windowMs = 800,
}: { now?: () => number; windowMs?: number } = {}) {
  const lastAt = new Map<string, number>();
  return {
    allow(key: string): boolean {
      const at = now();
      const previous = lastAt.get(key);
      if (previous !== undefined && at - previous < windowMs) return false;
      lastAt.set(key, at);
      return true;
    },
  };
}

export const placeNavigationGuard = createNavigationGuard();

type PushRouter = { push: (href: { params: { origin: string; slug: string }; pathname: '/place/[slug]' }) => void };

/** Opens the editorial Place screen for a Map origin. Returns false if ignored. */
export function openPlaceFromMap(
  router: PushRouter,
  slug: string | null | undefined,
  guard: Pick<ReturnType<typeof createNavigationGuard>, 'allow'> = placeNavigationGuard
): boolean {
  if (!slug || !guard.allow(`place:${slug}`)) return false;
  router.push({ pathname: '/place/[slug]', params: { origin: 'map', slug } });
  return true;
}

/** Where a Place was opened from, as carried in its route params. */
export type PlaceOriginContext = {
  date?: string;
  diaryId?: string;
  notebookId?: string;
  origin?: string;
  tripId?: string;
};

type PlaceBackRouter = {
  back: () => void;
  canGoBack: () => boolean;
  dismissTo: (href: Href) => void;
  replace: (href: Href) => void;
};

/**
 * The visible back arrow of the root-stack Place. The Place is an ordinary
 * root-stack screen above the tabs, so with any history behind it, back simply
 * pops it: the same operation as the iOS edge swipe, landing on the screen that
 * opened it (Search, Map, Discover, Favourites, Trip, Notebook) exactly as it was.
 *
 * Only when there is no history (a direct link or cold start) is a destination
 * chosen explicitly, from the origin recorded in the route params. Repeat taps are
 * ignored for a moment. Returns what it did, for tests.
 */
export function backFromPlace(
  router: PlaceBackRouter,
  context: PlaceOriginContext = {},
  guard: Pick<ReturnType<typeof createNavigationGuard>, 'allow'> = placeNavigationGuard
): 'back' | 'fallback' | 'ignored' {
  // A repeat tap before the screen has gone would pop the screen beneath as well.
  if (!guard.allow('place-back')) return 'ignored';
  if (router.canGoBack()) {
    router.back();
    return 'back';
  }
  const { date, diaryId, notebookId, origin, tripId } = context;
  if (origin === 'favourites') router.dismissTo('/favourites');
  else if (origin === 'trip-map' && tripId) router.dismissTo({ pathname: '/trips/[tripId]/map', params: { tripId } });
  else if (origin === 'notebook' && notebookId) router.dismissTo({ pathname: '/notebooks/[notebookId]', params: { notebookId } });
  else if (origin === 'diary' && diaryId && date) router.dismissTo({ pathname: '/diaries/[diaryId]/day', params: { date, diaryId } });
  else if (origin === 'map') router.replace('/map');
  else if (origin === 'search') router.replace('/search');
  else router.replace('/discover');
  return 'fallback';
}
