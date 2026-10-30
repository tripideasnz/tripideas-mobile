// Shared test fixtures for Shared Trips: a DTO as the API sends it, built from small pieces.
export const note = (overrides = {}) => ({
  author: { displayName: 'Ana', id: 'user_owner', isCollectionOwner: true },
  canDelete: false,
  canEdit: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  id: 'note_1',
  mine: false,
  text: 'A note',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

export const memberNote = (overrides = {}) =>
  note({
    author: { displayName: 'Ben', id: 'user_member', isCollectionOwner: false },
    canDelete: true,
    canEdit: true,
    id: 'note_member',
    mine: true,
    text: 'Ben says hi',
    ...overrides,
  });

export const detail = (overrides = {}) => ({
  collection: { createdAt: '2026-10-01T00:00:00.000Z', id: 'fc_1', title: 'South Island', updatedAt: '2026-10-02T00:00:00.000Z' },
  notes: [note({ id: 'cn_owner', text: 'Pack warm' }), memberNote({ id: 'cn_member', text: 'Bring a hat' })],
  owner: { displayName: 'Ana', id: 'user_owner' },
  permissions: {
    canAddCollectionNote: true,
    canAddPlaceNote: true,
    canEditStructure: false,
    canInvite: true,
    canLeave: true,
    canSaveCopy: true,
  },
  places: [
    { itemId: 'fci_a', notes: [note({ id: 'pn_a_owner', text: 'Book early' }), memberNote({ id: 'pn_a_member', text: 'Booked' })], placeId: 'place-a', position: 0 },
    { itemId: 'fci_b', notes: [], placeId: 'place-b', position: 1 },
    { itemId: 'fci_c', notes: [note({ id: 'pn_c_owner', text: 'Sunrise' })], placeId: 'place-c', position: 2 },
  ],
  structure: { managedByTrip: true },
  viewer: { id: 'user_member', joinedAt: '2026-10-03T00:00:00.000Z', role: 'member' },
  ...overrides,
});

export const summary = (overrides = {}) => ({
  id: 'fc_1',
  joinedAt: '2026-10-03T00:00:00.000Z',
  managedByTrip: true,
  owner: { displayName: 'Ana', id: 'user_owner' },
  placeCount: 3,
  title: 'South Island',
  updatedAt: '2026-10-02T00:00:00.000Z',
  ...overrides,
});

/** A fetch that answers from a list of [matcher, responder] pairs and records every call. */
/** GET /collections/:id/preview, as the API sends it (see shared-trip-api.md in the API repository). */
export const previewDto = (overrides = {}) => ({
  collection: { createdAt: '2026-10-01T00:00:00.000Z', id: 'fc_1', title: 'South Island', updatedAt: '2026-10-02T00:00:00.000Z' },
  creator: { displayName: 'Ana' },
  places: [
    { note: { text: 'Book early', updatedAt: 'u' }, placeId: 'place-a', position: 0 },
    { note: null, placeId: 'place-b', position: 1 },
    { note: { text: 'Sunrise', updatedAt: 'u' }, placeId: 'place-c', position: 2 },
  ],
  sharing: { canJoin: true, canSaveCopy: true, kind: 'live_trip', status: 'shared' },
  tripNote: { text: 'Pack warm', updatedAt: 'u' },
  ...overrides,
});

export function fakeFetch(routes) {
  const calls = [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input));
    const call = { body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers ?? {}, method: init.method ?? 'GET', path: url.pathname };
    calls.push(call);
    for (const [matches, respond] of routes) {
      if (matches(call)) return respond(call);
    }
    return new Response('{"name":"NOT_FOUND"}', { status: 404 });
  };
  fetcher.calls = calls;
  return fetcher;
}
export const on = (method, path) => (call) => call.method === method && call.path === path;
export const onPrefix = (method, prefix) => (call) => call.method === method && call.path.startsWith(prefix);
