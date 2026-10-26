// Saved landing-page card layout (Batch 2B): readable text, a dedicated chevron
// area, and wrapping that cannot reach the arrow. The real SavedModule is rendered
// with the React Native modules stubbed, and the resolved element tree inspected.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

const stubSource = `
const base = BASE_URL;
const stubs = ['react-native', '@expo/vector-icons/MaterialIcons'];
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (stubs.includes(specifier)) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const sources = {
    'react-native': \`import { createElement } from 'react'; const h = (t) => (p) => createElement(t, p); export const View = h('View'); export const Text = h('Text'); export const Pressable = h('Pressable');\`,
    '@expo/vector-icons/MaterialIcons': \`import { createElement } from 'react'; export default (p) => createElement('Icon', p);\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[url.slice(5)] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

const { createElement } = await import('react');
const { SavedModule } = await import('./saved-module.tsx');
const { Palette, Space } = await import('../constants/design.ts');

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const render = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (Array.isArray(node)) return node.map(render).filter((c) => c !== null);
  if (typeof node !== 'object') return node;
  const { type, props } = node;
  if (typeof type === 'function') return render(type(props));
  const style = typeof props.style === 'function' ? props.style({ pressed: false }) : props.style;
  const kids = render(props.children);
  return { children: kids === null ? [] : Array.isArray(kids) ? kids : [kids], props: { ...props, style }, type };
};
const flat = (t) => (t && typeof t === 'object' ? (Array.isArray(t) ? t.flatMap(flat) : [t, ...flat(t.children)]) : []);
const card = (extra = {}) => render(createElement(SavedModule, { description: 'Create your own places with notes, photos, and a location.', icon: 'folder', onPress() {}, stateText: '3 places', title: 'Personal Places', ...extra }));
const merged = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

test('card keeps its proportions: min height, no fixed height, same padding and radius', () => {
  const style = card().props.style;
  assert.equal(style.minHeight, 76);
  assert.equal(style.height, undefined, 'no fixed height that could clip wrapped or large text');
  assert.equal(style.paddingHorizontal, Space.lg);
  assert.equal(style.paddingVertical, Space.md);
  assert.equal(style.flexDirection, 'row');
});

test('title, description and count form a clear hierarchy', () => {
  const texts = flat(card()).filter((n) => n.type === 'Text').map((n) => ({ text: n.children.join(''), style: merged(n.props.style) }));
  assert.deepEqual(texts.map((t) => t.text), ['Personal Places', 'Create your own places with notes, photos, and a location.', '3 places']);
  const [title, description, count] = texts.map((t) => t.style);
  assert.ok(title.fontSize >= 16 && title.fontWeight === '700');
  assert.ok(description.fontSize >= 15 && description.fontSize < title.fontSize + 1, 'readable but below the title');
  assert.ok(description.lineHeight >= description.fontSize * 1.3);
  assert.ok(count.fontSize < description.fontSize, 'count is the quietest line');
  assert.equal(description.color, Palette.textBody);
  assert.equal(count.color, Palette.textMuted);
});

test('text column shrinks and wraps; the chevron has its own area at least 16 pt away', () => {
  const tree = card();
  const [icon, textColumn, chevronArea] = tree.children;
  assert.equal(icon.type, 'Icon');
  assert.equal(textColumn.props.style.flex, 1);
  assert.equal(textColumn.props.style.minWidth, 0, 'allows natural wrapping');
  assert.equal(textColumn.props.style.marginRight, undefined);
  assert.ok(chevronArea.props.style.marginLeft >= 16, 'at least 16 pt between text and chevron');
  assert.ok(chevronArea.props.style.width >= 28, 'dedicated chevron area');
  assert.equal(chevronArea.props.style.alignItems, 'center');
  assert.equal(chevronArea.props.style.justifyContent, 'center');
  assert.equal(chevronArea.props.style.flex, undefined, 'the chevron area never grows into the text');
  assert.equal(chevronArea.props.style.flexShrink, undefined);
});

test('the chevron is larger, blue, and identical across cards', () => {
  const chevrons = ['Favourites', 'Trips', 'Personal Places'].map((title) =>
    flat(card({ title })).find((n) => n.type === 'Icon' && n.props.name === 'chevron-right').props);
  for (const chevron of chevrons) {
    assert.equal(chevron.size, 30);
    assert.equal(chevron.color, Palette.trip);
  }
});

test('cards without a description (Notebooks, Diaries) still lay out', () => {
  const tree = card({ description: undefined });
  assert.equal(flat(tree).filter((n) => n.type === 'Text').length, 2);
});

test('card destinations are unchanged', async () => {
  const saved = await read('app/(tabs)/saved.tsx');
  for (const [label, route] of [['Open Favourites', '/favourites'], ['Open Trips', '/trips'], ['Open Personal Places', '/personal-place-cards']]) {
    assert.match(saved, new RegExp(`accessibilityLabel: '${label}'[\\s\\S]*?openPrivateFeature\\('${route}'\\)`));
  }
  assert.match(saved, /router\.navigate\(destination\)/);
  assert.match(saved, /<SavedModule key=\{module\.title\} \{\.\.\.module\} \/>/);
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
