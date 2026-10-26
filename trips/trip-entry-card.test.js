// TripEntryCard (Batch 2E.1): what an entry shows while its editorial card is pending,
// once it has arrived, and when it never will. Rendered to static markup with the
// image/navigation-heavy child components replaced by labelled stand-ins.
import assert from 'node:assert/strict';
import { register } from 'node:module';

const stubSource = `
const host = 'import { createElement } from "react"; const flat = (s) => (typeof s === "function" ? s({ pressed: false }) : s); export const h = (type, label) => ({ style, children, accessibilityLabel }) => createElement("div", { "data-type": type, "data-label": accessibilityLabel, "data-style": JSON.stringify([style].flat(Infinity).map(flat).reduce((a, b) => ({ ...a, ...(b ?? {}) }), {})) }, label ?? children);';
const stubs = {
  'react-native': host + ' export const View = h("View"); export const Text = h("Text"); export const Alert = { alert() {} };',
  '@expo/vector-icons/MaterialIcons': 'import { createElement } from "react"; export default () => createElement("i");',
  '@/components/place-card': host + ' export const PlaceCard = ({ place }) => h("PlaceCard")({ children: "PlaceCard:" + place.title });',
  '@/components/personal-place-card-view': host + ' export const PersonalPlaceCardView = ({ card }) => h("Personal")({ children: "Personal:" + card.title });',
  '@/components/ui/autosave-note': host + ' export const AutosaveNote = ({ accessibilityLabel }) => h("Note")({ accessibilityLabel, children: "note" });',
  '@/components/ui/card-surface': host + ' export const CardSurface = ({ children }) => h("Card")({ children });',
  '@/components/ui/icon-action': host + ' export const IconAction = ({ accessibilityLabel }) => h("IconAction")({ accessibilityLabel });',
};
const base = BASE_URL;
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (specifier in stubs) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  return { format: 'module', shortCircuit: true, source: stubs[url.slice(5)] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { TripEntryCard } = await import('../components/trip-entry-card.tsx');

const tests = [];
const test = (name, run) => tests.push({ name, run });

const editorial = { editorialPlace: { id: 'p1' }, id: 'e1', itineraryId: 't1', note: 'my note', order: 0, type: 'editorialPlace' };
const personal = { id: 'e2', itineraryId: 't1', note: null, order: 1, personalPlaceCard: { id: 'c1', title: 'Secret beach', media: [] }, type: 'personalPlaceCard' };
const render = (props) => renderToStaticMarkup(createElement(TripEntryCard, {
  canMoveDown: true, canMoveUp: false, highlighted: false, onNavigateDown() {}, onNavigateUp() {}, onRemove: async () => {}, onSaveNote: async () => {}, ...props,
}));

test('pending editorial entry: a placeholder with the card\'s 4:3 image area, never "unavailable"', () => {
  const html = render({ editorialPending: true, entry: editorial });
  assert.match(html, /data-label="Loading place"/);
  assert.match(html, /Loading place…/);
  assert.match(html, /&quot;aspectRatio&quot;:1\.3333/, 'same 4:3 image area as a loaded card, so nothing jumps');
  assert.doesNotMatch(html, /Editorial place unavailable/);
});

test('pending entry still shows the reorder, remove and note controls: the Trip is usable immediately', () => {
  const html = render({ editorialPending: true, entry: editorial });
  assert.match(html, /Go to next place after Editorial place/);
  assert.match(html, /Remove Editorial place from Trip/);
  assert.match(html, /data-label="note for Editorial place"/);
});

test('once the card arrives the real card replaces the placeholder', () => {
  const html = render({ editorialPending: false, editorialPlace: { _id: 'p1', title: 'Milford Sound' }, entry: editorial });
  assert.match(html, /PlaceCard:Milford Sound/);
  assert.doesNotMatch(html, /Loading place/);
  assert.match(html, /Go to next place after Milford Sound/, 'labels use the real title');
});

test('settled without a card (Sanity failed or the Place is gone): "unavailable", and the entry remains', () => {
  const html = render({ editorialPending: false, entry: editorial });
  assert.match(html, /Editorial place unavailable/);
  assert.doesNotMatch(html, /Loading place/);
  assert.match(html, /data-label="note for Editorial place"/, 'its note and controls are still there');
});

test('a Personal Place entry renders its own content whatever the editorial state', () => {
  for (const editorialPending of [true, false]) {
    const html = render({ editorialPending, entry: personal });
    assert.match(html, /Personal:Secret beach/);
    assert.doesNotMatch(html, /Loading place|Editorial place unavailable/);
  }
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
