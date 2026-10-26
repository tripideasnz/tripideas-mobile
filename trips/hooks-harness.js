// Shared hooks-runtime harness for the Trips provider tests.
//
// Executes the real MyTripsProvider / useTripPlaceCards through a small hooks runtime
// (useState/useRef/useMemo/useCallback/useEffect with deps and cleanup), with the
// session, API, storage and Sanity layers replaced by controllable fakes.
import { register } from 'node:module';

const stubSource = `
const stubs = {
  'react': 'export const createContext = (d) => ({ _default: d, Provider: "Provider" }); export const useState = (i) => globalThis.__hooks.useState(i); export const useRef = (i) => globalThis.__hooks.useRef(i); export const useMemo = (f, d) => globalThis.__hooks.useMemo(f, d); export const useCallback = (f, d) => globalThis.__hooks.useCallback(f, d); export const useContext = (c) => globalThis.__hooks.useContext(c); export const useEffect = (f, d) => globalThis.__hooks.useEffect(f, d);',
  'react/jsx-runtime': 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = "Fragment";',
  '@/auth/provider': 'export const useSession = () => globalThis.__session;',
  '@/sanity/place-cards': 'export const fetchPlaceCardsByIds = (ids) => globalThis.__fetchPlaceCards(ids);',
  '@/trips/storage': 'export const getMyTrips = (...a) => globalThis.__store.getMyTrips(...a); export const setMyTrips = (...a) => globalThis.__store.setMyTrips(...a); export const tripStorage = { getCache: (...a) => globalThis.__store.getCache(...a), setCache: (...a) => globalThis.__store.setCache(...a), getClaim: (...a) => globalThis.__store.getClaim(...a), getDeletedTripIds: (...a) => globalThis.__store.getDeletedTripIds(...a), getJournal: (...a) => globalThis.__store.getJournal(...a), addDeletedTripId: (...a) => globalThis.__store.addDeletedTripId(...a) };',
  'expo-crypto': 'import { createHash } from "node:crypto"; export const CryptoDigestAlgorithm = { SHA256: "SHA256" }; export const digestStringAsync = async (_algorithm, value) => createHash("sha256").update(value).digest("hex");',
  '@/trips/migration': 'import * as real from "MIGRATION_URL"; export const fingerprintLegacyTrips = real.fingerprintLegacyTrips; export const migrationProgress = real.migrationProgress; export const projectVisibleTrips = real.projectVisibleTrips; export const shouldOfferTripImport = real.shouldOfferTripImport; export const runTripMigration = (...a) => (globalThis.__runTripMigration ?? real.runTripMigration)(...a);',
  '@/trips/api': ['addEditorialEntryRequest','addPersonalCardEntryRequest','createTripRequest','deleteEntryRequest','deleteTripRequest','listEditorialTripEntries','listTripSummaries','listTrips','loadTrip','updateEntryNoteRequest','updateTripRequest'].map((n) => 'export const ' + n + ' = (...a) => globalThis.__api.' + n + '(...a);').join(' '),
};
export async function resolve(specifier, context, next) {
  if (specifier in stubs) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  return { format: 'module', shortCircuit: true, source: stubs[url.slice(5)] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('MIGRATION_URL', new URL('./migration.ts', import.meta.url).href))}`, import.meta.url);

const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 12; i += 1) await tick(); };

function mount(component, initialProps) {
  let slots = []; let cursor = 0; let pending = []; let dirty = false; let output; let props = initialProps; let renders = 0;
  const self = {
    get output() { return output; }, get renders() { return renders; },
    setProps(next) { props = next; render(); },
    rerender() { render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
  const schedule = () => { if (dirty) return; dirty = true; queueMicrotask(() => { dirty = false; render(); }); };
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      const slot = slots[i];
      return [slot.value, (v) => { const next = typeof v === 'function' ? v(slot.value) : v; if (!Object.is(next, slot.value)) { slot.value = next; schedule(); } }];
    },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useMemo(fn, deps) { const i = cursor++; const prev = slots[i]; if (prev && sameDeps(prev.deps, deps)) return prev.value; const value = fn(); slots[i] = { deps, value }; return value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useContext(context) { return context._default; },
    useEffect(fn, deps) {
      const i = cursor++; const prev = slots[i];
      if (!prev || !deps || !sameDeps(prev.deps, deps)) pending.push({ deps, fn, i });
      else slots[i] = prev;
    },
  };
  function render() {
    globalThis.__hooks = hooks; cursor = 0; pending = [];
    output = component(props); renders += 1;
    const toRun = pending; pending = [];
    for (const { deps, fn, i } of toRun) {
      slots[i]?.cleanup?.();
      globalThis.__hooks = hooks;
      const cleanup = fn();
      slots[i] = { cleanup: typeof cleanup === 'function' ? cleanup : undefined, deps };
    }
  }
  render();
  return self;
}

const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, reject, resolve }; };
const trip = (id, name, placeIds = []) => ({
  createdAt: '2026-01-01T00:00:00.000Z', id, name, note: '', updatedAt: '2026-01-01T00:00:00.000Z',
  places: placeIds.map((placeId) => ({ addedAt: '2026-01-01T00:00:00.000Z', entryId: `${id}-${placeId}`, note: '', placeId })),
});


const { MyTripsProvider } = await import('./provider.tsx');
const { useTripPlaceCards } = await import('./use-trip-place-cards.ts');
const { tripDetailView } = await import('./detail-state.ts');

const userA = { session: { userId: 'user-a' }, user: { email: 'a@example.com', name: 'A' } };
const userB = { session: { userId: 'user-b' }, user: { email: 'b@example.com', name: 'B' } };
const signedOut = { session: null, user: null };

// Fresh fakes for every scenario.
globalThis.__setCacheHook = undefined;
globalThis.__runTripMigration = undefined;

function world({ caches = {}, listTrips, overrides = {} } = {}) {
  globalThis.__setCacheHook = undefined; globalThis.__runTripMigration = undefined;
  const calls = { listTrips: 0, listTripSummaries: 0, loadTrip: 0, updateTripRequest: 0, deleteTripRequest: 0 };
  const cache = { ...caches };
  globalThis.__store = {
    addDeletedTripId: async (_user, id) => [id],
    getCache: async (user) => cache[user] ?? [],
    getClaim: async () => null,
    getDeletedTripIds: async () => [],
    getJournal: async () => null,
    getMyTrips: async () => [],
    // A test can take over timing: the hook receives the write and the "disk" and decides when it lands.
    setCache: async (user, next) => { if (globalThis.__setCacheHook) return globalThis.__setCacheHook(user, next, cache); cache[user] = next; return next; },
    setMyTrips: async (next) => next,
  };
  const server = { trips: {} };
  globalThis.__api = new Proxy({
    deleteTripRequest: async (id) => { calls.deleteTripRequest += 1; for (const list of Object.values(server.trips)) { const at = list.findIndex((t) => t.id === id); if (at >= 0) list.splice(at, 1); } },
    listTripSummaries: async () => { calls.listTripSummaries += 1; return (server.trips[globalThis.__session.session?.userId] ?? []).map((t) => ({ description: null, entryOrder: [], id: t.id, name: t.name })); },
    listTrips: async (...args) => { calls.listTrips += 1; return listTrips(...args); },
    loadTrip: async (summary, cached) => { calls.loadTrip += 1; const t = (server.trips[globalThis.__session.session?.userId] ?? []).find((x) => x.id === summary.id); return { ...(cached ?? t), ...t }; },
    updateTripRequest: async (id, input) => { calls.updateTripRequest += 1; for (const list of Object.values(server.trips)) { const t = list.find((x) => x.id === id); if (t) t.name = input.name; } },
    ...overrides,
  }, { get: (target, name) => target[name] ?? (async () => undefined) });
  return { cache, calls, server };
}

const mountProvider = () => mount(MyTripsProvider, { children: null });
const valueOf = (mounted) => mounted.output.props.value;
const flags = (mounted) => { const v = valueOf(mounted); return { isLoading: v.isLoading, isRefreshing: v.isRefreshing, trips: v.trips.map((t) => t.name) }; };

export { MyTripsProvider, deferred, flags, mount, mountProvider, settle, signedOut, trip, tripDetailView, useTripPlaceCards, userA, userB, valueOf, world };
