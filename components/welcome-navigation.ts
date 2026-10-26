// The two ways in from the welcome screen, and how they navigate.
//
// Both use `replace`, not `push`: the welcome screen is an introduction, so entering the
// app swaps it out of the root stack. No history entry is left behind, an edge swipe
// cannot bring the welcome screen back, and Discover and Map behave exactly like any
// other tab destination. Repeat taps are ignored for a moment so a double tap cannot
// replace twice.
import { createNavigationGuard } from '@/components/map/place-navigation';

export type WelcomeDestination = {
  accessibilityHint: string;
  accessibilityLabel: string;
  href: '/discover' | '/map';
  key: 'discover' | 'map';
  label: string;
};

export const WELCOME_DESTINATIONS: readonly WelcomeDestination[] = [
  {
    accessibilityHint: 'Opens Discover to browse islands, regions and places.',
    accessibilityLabel: 'Discover',
    href: '/discover',
    key: 'discover',
    label: 'Discover',
  },
  {
    accessibilityHint: 'Opens the map of places.',
    accessibilityLabel: 'Map',
    href: '/map',
    key: 'map',
    label: 'Map',
  },
];

type ReplaceRouter = { replace: (href: WelcomeDestination['href']) => void };

const welcomeGuard = createNavigationGuard();

/** Leaves the welcome screen for a destination. Returns false if a repeat tap was ignored. */
export function openFromWelcome(
  router: ReplaceRouter,
  destination: WelcomeDestination,
  guard: Pick<ReturnType<typeof createNavigationGuard>, 'allow'> = welcomeGuard
): boolean {
  if (!guard.allow('welcome')) return false;
  router.replace(destination.href);
  return true;
}
