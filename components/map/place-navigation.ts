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

type BackRouter = {
  back: () => void;
  canGoBack: () => boolean;
  navigate: (href: '/map') => void;
};

/**
 * Back from a Place that was opened from the Map. The Place is popped off the
 * Discover stack it was pushed onto, then the Map tab is shown again. The Map
 * screen stays mounted, so its camera, filters and selection are exactly as the
 * user left them.
 */
export function returnToMapFromPlace(
  router: BackRouter,
  guard: Pick<ReturnType<typeof createNavigationGuard>, 'allow'> = placeNavigationGuard
): boolean {
  if (!guard.allow('place-back:map')) return false;
  if (router.canGoBack()) router.back();
  router.navigate('/map');
  return true;
}
