// Opening an editorial Place from the Map, and returning to the Map.
//
// Every entry point (marker label, peek-sheet thumbnail, full Place list) goes
// through openPlaceFromMap, so the same Place route opens with the same origin,
// and rapid repeat taps cannot push the screen twice.

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

type BackRouter<Tab extends string> = {
  back: () => void;
  canGoBack: () => boolean;
  navigate: (href: Tab) => void;
};

type Guard = Pick<ReturnType<typeof createNavigationGuard>, 'allow'>;

/**
 * Back from a Place that was opened from another tab (Map, Search). The Place
 * lives on the Discover stack, so a plain back lands on Discover. Instead it is
 * popped off that stack and the tab it came from is shown again. That tab's
 * screen stays mounted, so its state (camera and filters, query and results) is
 * exactly as the user left it.
 */
export function returnToOriginTab<Tab extends '/map' | '/search'>(
  router: BackRouter<Tab>,
  tab: Tab,
  guard: Guard = placeNavigationGuard
): boolean {
  if (!guard.allow(`place-back:${tab}`)) return false;
  if (router.canGoBack()) router.back();
  router.navigate(tab);
  return true;
}

export const returnToMapFromPlace = (router: BackRouter<'/map'>, guard: Guard = placeNavigationGuard) =>
  returnToOriginTab(router, '/map', guard);

export const returnToSearchFromPlace = (router: BackRouter<'/search'>, guard: Guard = placeNavigationGuard) =>
  returnToOriginTab(router, '/search', guard);
