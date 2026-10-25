/**
 * Runs one operation at a time. While one is in progress further calls return
 * `skipped` immediately, so repeated taps never start overlapping requests.
 */
export function createSingleFlight() {
  let active = false;
  return {
    get isActive() {
      return active;
    },
    async run<T>(operation: () => Promise<T>): Promise<{ skipped: true } | { skipped: false; value: T }> {
      if (active) return { skipped: true };
      active = true;
      try {
        return { skipped: false, value: await operation() };
      } finally {
        active = false;
      }
    },
  };
}
