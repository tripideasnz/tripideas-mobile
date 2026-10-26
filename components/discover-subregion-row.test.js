// Batch 2G: sub-region rows in an expanded Discover region.
//
// Root cause (proved below with the real Radix Slot): `<Link asChild><Pressable style={fn}>`
// turned the row's function style into `{}`, so `flexDirection: 'row'`, padding, divider and
// pressed opacity were all lost and title, Māori name, count and chevron stacked vertically.
// The row is now a plain Pressable. Its real component is rendered here with the native
// modules stubbed and the resolved element tree inspected. How it looks is for the Simulator.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire, register } from 'node:module';

const stubSource = `
const base = BASE_URL;
const stubs = ['react-native', 'expo-image', 'expo-router', '@/components/ui/icon-symbol'];
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (stubs.includes(specifier)) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const sources = {
    'react-native': \`import { createElement } from 'react'; const h = (t) => (p) => createElement(t, p); export const View = h('View'); export const Text = h('Text'); export const Pressable = h('Pressable');\`,
    'expo-image': \`import { createElement } from 'react'; export const Image = (p) => createElement('Image', p);\`,
    'expo-router': 'export const useRouter = () => globalThis.__router;',
    '@/components/ui/icon-symbol': \`import { createElement } from 'react'; export const IconSymbol = (p) => createElement('IconSymbol', p);\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[url.slice(5)] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

const { createElement } = await import('react');
const { SubRegionLink, SUBREGION_COUNT_MIN_WIDTH, SUBREGION_ROW_MIN_HEIGHT } = await import('./discover-subregion-row.tsx');
const { Palette, Space, Type } = await import('../constants/design.ts');

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

// Resolve function components to host nodes; keep each Pressable's style function callable.
const render = (node, pressed = false) => {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (Array.isArray(node)) return node.map((child) => render(child, pressed)).filter((child) => child !== null);
  if (typeof node !== 'object') return node;
  const { type, props } = node;
  if (typeof type === 'function') return render(type(props), pressed);
  const style = typeof props.style === 'function' ? props.style({ pressed }) : props.style;
  const kids = render(props.children, pressed);
  return { children: kids === null ? [] : Array.isArray(kids) ? kids : [kids], props: { ...props, style }, type };
};
const texts = (tree) => (typeof tree === 'string' || typeof tree === 'number' ? [String(tree)] : (tree?.children ?? []).flatMap(texts));

const row = (subRegion, pressed = false) => render(createElement(SubRegionLink, { subRegion }), pressed);
const eastern = { _id: 'e', imageUrl: 'https://img/e.jpg', maori: 'Te-tara-o-te-ika-a-Māui', name: 'Eastern Coromandel', placeCount: 43, slug: { current: 'eastern-coromandel' } };
const western = { _id: 'w', name: 'Western Coromandel', placeCount: 6, slug: { current: 'western-coromandel' } };
const longTitle = { _id: 'l', maori: 'Te Tai Tokerau', name: 'Whangārei Heads, Bream Bay and the Hen and Chicken Islands Coast', placeCount: 128, slug: { current: 'long' } };
const noCount = { _id: 'n', name: 'Somewhere new', slug: { current: 'new' } };

// A row's three parts: [thumbnail?], left column, right section.
const parts = (tree) => {
  const [first, ...rest] = tree.children;
  const hasImage = first.type === 'Image';
  return { image: hasImage ? first : null, left: hasImage ? rest[0] : first, right: hasImage ? rest[1] : rest[0] };
};

test('root cause: a Link/Slot turns a function style into {}, which is what collapsed the row', () => {
  const require = createRequire(import.meta.url);
  const Slot = require('@radix-ui/react-slot').Slot;
  const { renderToStaticMarkup } = require('react-dom/server');
  const probe = (style) => renderToStaticMarkup(createElement(Slot, null, createElement((props) => createElement('pre', null, JSON.stringify(typeof props.style === 'function' ? 'fn' : props.style)), { style })));
  assert.match(probe(() => ({ flexDirection: 'row' })), /\{\}/, 'a function style is lost');
  assert.match(probe({ flexDirection: 'row' }), /flexDirection/, 'an object style survives');
});

test('the row is a plain horizontal Pressable, not a Link wrapping a function style', async () => {
  const tree = row(eastern);
  assert.equal(tree.type, 'Pressable');
  assert.equal(tree.props.style.flexDirection, 'row');
  assert.equal(tree.props.style.alignItems, 'center');
  assert.equal(tree.props.accessibilityRole, 'link');
  const source = await read('components/discover-subregion-row.tsx');
  assert.doesNotMatch(source.replace(/^\/\/.*$/gm, ''), /asChild|<Link/, 'no Slot in the way');
  const discover = await read('app/(tabs)/(discover)/discover.tsx');
  assert.doesNotMatch(discover, /asChild|<Link/, 'nor anywhere in the Discover screen');
});

test('Eastern Coromandel: name with the Māori name beneath on the left; 43 and a chevron together on the right', () => {
  const tree = row(eastern);
  const { image, left, right } = parts(tree);
  assert.ok(image, 'thumbnail first');
  assert.deepEqual(left.children.map((c) => texts(c).join('')), ['Eastern Coromandel', 'Te-tara-o-te-ika-a-Māui'], 'name above Māori name in one column');
  assert.deepEqual(texts(left.children[0]), ['Eastern Coromandel']);
  assert.deepEqual(right.children.map((c) => (c.type === 'IconSymbol' ? 'chevron' : texts(c).join(''))), ['43', 'chevron'], 'count then chevron, side by side');
  assert.equal(right.children[1].props.name, 'chevron.right');
});

test('Western Coromandel: no Māori name leaves just the title, with the count and chevron still on the right', () => {
  const { left, right, image } = parts(row(western));
  assert.equal(image, null, 'no thumbnail: the text column starts at the left edge');
  assert.deepEqual(left.children.map((c) => texts(c).join('')), ['Western Coromandel']);
  assert.deepEqual(right.children.map((c) => (c.type === 'IconSymbol' ? 'chevron' : texts(c).join(''))), ['6', 'chevron']);
});

test('the left column is flexible and may shrink; the right section never shrinks, so a long title wraps instead of pushing the count or chevron', () => {
  for (const sub of [eastern, western, longTitle, noCount]) {
    const { left, right } = parts(row(sub));
    assert.equal(left.props.style.flex, 1);
    assert.equal(left.props.style.minWidth, 0, 'allows the text to wrap');
    assert.equal(right.props.style.flexShrink, 0, 'count and chevron never squeezed or wrapped');
    assert.equal(right.props.style.flexDirection, 'row', 'count and chevron on one line');
    assert.equal(right.props.style.alignItems, 'center', 'vertically centred together');
  }
  const { left } = parts(row(longTitle));
  assert.equal(texts(left.children[0]).join(''), longTitle.name, 'the whole long title is rendered, wrapping within its column');
  assert.equal(left.children[0].props.numberOfLines, undefined, 'never truncated');
});

test('all rows share the same alignment: identical row and right-section styles, counts right-aligned at a fixed width', () => {
  const rows = [eastern, western, longTitle].map((sub) => parts(row(sub)));
  const rightStyles = rows.map(({ right }) => right.props.style);
  for (const style of rightStyles) assert.deepEqual(style, rightStyles[0]);
  for (const { right } of rows) {
    const count = right.children[0];
    assert.equal(count.props.style.minWidth, SUBREGION_COUNT_MIN_WIDTH);
    assert.equal(count.props.style.textAlign, 'right', '6 and 43 and 128 line up on their right edge, so the chevrons align too');
  }
  const trees = [eastern, western, longTitle].map((sub) => row(sub));
  for (const tree of trees) assert.deepEqual({ ...tree.props.style, opacity: undefined }, { ...trees[0].props.style, opacity: undefined });
});

test('a row without a count shows just the chevron on the right', () => {
  const { right } = parts(row(noCount));
  assert.deepEqual(right.children.map((c) => c.type), ['IconSymbol']);
});

test('existing typography and colours are unchanged', () => {
  const { left, right } = parts(row(eastern));
  assert.deepEqual(left.children[0].props.style, Type.bodyStrong, 'bold title');
  assert.equal(left.children[1].props.style.color, Palette.textMuted);
  assert.equal(left.children[1].props.style.fontSize, Type.caption.fontSize, 'Māori name in the caption size');
  assert.equal(left.children[1].props.style.marginTop, Space.xs);
  assert.equal(right.children[0].props.style.color, Palette.textMuted);
  assert.equal(right.children[0].props.style.fontSize, Type.label.fontSize);
  assert.equal(right.children[1].props.color, Palette.textMuted);
  assert.equal(right.children[1].props.size, 16);
});

test('padding, divider, pressed feedback and a comfortable touch target are all present again', () => {
  const idle = row(eastern); const pressed = row(eastern, true);
  assert.equal(idle.props.style.paddingVertical, 14);
  assert.equal(idle.props.style.borderBottomWidth, 1);
  assert.equal(idle.props.style.borderBottomColor, Palette.border);
  assert.equal(idle.props.style.opacity, 1);
  assert.equal(pressed.props.style.opacity, 0.6);
  assert.ok(idle.props.style.minHeight >= 44 && idle.props.style.minHeight === SUBREGION_ROW_MIN_HEIGHT);
  const { image } = parts(idle);
  assert.equal(image.props.style.flexShrink, 0, 'the thumbnail keeps its 44 pt size');
  assert.equal(image.props.style.width, 44);
});

test('navigation is unchanged: the same route and params, via the same action Link used', () => {
  const calls = [];
  globalThis.__router = { navigate: (href) => calls.push(href), push: () => calls.push('push!'), replace: () => calls.push('replace!') };
  for (const sub of [eastern, western]) row(sub).props.onPress();
  assert.deepEqual(calls, [
    { params: { slug: 'eastern-coromandel' }, pathname: '/subregion/[slug]' },
    { params: { slug: 'western-coromandel' }, pathname: '/subregion/[slug]' },
  ]);
  assert.equal(row({ _id: 'x', name: 'No slug' }).props.disabled, true, 'a row without a slug is disabled, as before');
  assert.equal(row(eastern).props.disabled, false);
});

test('Discover is otherwise untouched: expand/collapse, the sub-region list and the empty state', async () => {
  const discover = await read('app/(tabs)/(discover)/discover.tsx');
  assert.match(discover, /const next = !isOpen;\s*setIsOpen\(next\);\s*if \(next\) scrollToView\?\.\(viewRef\);/);
  assert.match(discover, /subRegions\.map\(\(subRegion, index\) => \(\s*<SubRegionLink\s*key=\{subRegion\._id \?\? subRegion\.slug\?\.current \?\? index\}\s*subRegion=\{subRegion\}\s*\/>/);
  assert.match(discover, /No sub-regions found\./);
  assert.match(discover, /import \{ SubRegionLink \} from '@\/components\/discover-subregion-row';/);
  assert.match(discover, /transform: \[\{ rotate: isOpen \? '90deg' : '0deg' \}\]/, 'the region chevron animation is untouched');
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
