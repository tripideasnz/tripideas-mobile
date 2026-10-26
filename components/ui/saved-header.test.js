// Saved header layout: component-level checks on the rendered element tree.
//
// The real SavedActionHeader and SavedHeaderActionButton are rendered with
// react-native and friends replaced by thin host stand-ins, then the resolved
// tree (styles after function-styles run, nesting, which node sits in which slot)
// is inspected. This checks the composition that decides whether a control can
// grow, not just that a style constant exists. The native iOS 26 capsule itself
// can only be confirmed on a device or Simulator.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

const stubSource = `
const base = BASE_URL;
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (['react-native', '@expo/vector-icons/MaterialIcons', '@expo/vector-icons/Ionicons', 'expo-router', 'react-native-safe-area-context'].includes(specifier)) {
    return { shortCircuit: true, url: 'stub:' + specifier };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const name = url.slice(5);
  const sources = {
    'react-native': \`
      import { createElement } from 'react';
      const host = (type) => (props) => createElement(type, props);
      export const View = host('View');
      export const Text = host('Text');
      export const Pressable = host('Pressable');
      export const StyleSheet = { hairlineWidth: 1 };
      export const Platform = { OS: 'ios', Version: '26.5' };
    \`,
    '@expo/vector-icons/MaterialIcons': \`import { createElement } from 'react'; export default (props) => createElement('Icon', props);\`,
    '@expo/vector-icons/Ionicons': \`import { createElement } from 'react'; export default (props) => createElement('Icon', props);\`,
    'expo-router': \`export const useRouter = () => ({ back() {}, canGoBack: () => true, replace() {} });\`,
    'react-native-safe-area-context': \`export const useSafeAreaInsets = () => ({ bottom: 34, left: 0, right: 0, top: 59 });\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[name] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

const { createElement } = await import('react');
const { SavedActionHeader, SavedHeaderActionButton, SAVED_HEADER_CONTROL_SIZE, savedActionHeader, savedHeaderSlotStyle } = await import('./saved-header.tsx');
const { clearHeaderRightAction, headerAddAction, headerShareAction } = await import('./header-actions.tsx');
const { HeaderBackButton } = await import('./header-back-button.tsx');

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

// Expand function components down to host nodes; resolve pressed-state styles.
const render = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (Array.isArray(node)) return node.map(render).filter((child) => child !== null);
  if (typeof node !== 'object') return node;
  const { type, props } = node;
  if (typeof type === 'function') return render(type(props));
  const style = typeof props.style === 'function' ? props.style({ pressed: false }) : props.style;
  const children = render(props.children);
  return { children: children === null ? [] : Array.isArray(children) ? children : [children], props: { ...props, style }, type };
};
const flat = (tree) => (tree === null || tree === undefined || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(flat) : [tree, ...flat(tree.children)]);
const find = (tree, predicate) => flat(tree).find(predicate);

const header = (options, back) =>
  render(createElement(SavedActionHeader, { back, navigation: {}, options, route: {} }));

const addOptions = (extra = {}) => ({ ...headerAddAction({ accessibilityLabel: 'Add Trip', onPress() {}, ...extra }), title: 'Trips' });
const actionNode = (tree) => find(tree, (n) => n.props?.accessibilityLabel === 'Add Trip');

test('the action is a fixed 44 pt circle that cannot grow or shrink', () => {
  const style = actionNode(header(addOptions(), { title: 'Saved' })).props.style;
  assert.equal(style.width, SAVED_HEADER_CONTROL_SIZE);
  assert.equal(style.height, SAVED_HEADER_CONTROL_SIZE);
  assert.equal(style.borderRadius, SAVED_HEADER_CONTROL_SIZE / 2);
  assert.equal(style.flexGrow, 0);
  assert.equal(style.flexShrink, 0);
  assert.equal(style.flex, undefined, 'no flex shorthand that could stretch it');
});

test('the action circle uses the same outline as the back circle', () => {
  const style = actionNode(header(addOptions(), { title: 'Saved' })).props.style;
  assert.equal(style.borderColor, '#c9c9c4');
  assert.equal(style.borderWidth, 1);
  const back = find(header(addOptions(), { title: 'Saved' }), (n) => n.props?.accessibilityLabel === 'Go back');
  assert.equal(back.props.style.borderColor, style.borderColor);
  assert.equal(back.props.style.borderWidth, style.borderWidth);
});

test('the icon is centred in the circle', () => {
  const style = actionNode(header(addOptions(), { title: 'Saved' })).props.style;
  assert.equal(style.alignItems, 'center');
  assert.equal(style.justifyContent, 'center');
  const action = actionNode(header(addOptions(), { title: 'Saved' }));
  assert.ok(action.children.some((child) => child.type === 'Icon' && child.props.name === 'add'));
});

test('the touch target meets the 44 pt minimum and stays accessible', () => {
  const node = actionNode(header(addOptions({ disabled: true }), { title: 'Saved' }));
  assert.ok(node.props.style.width >= 44 && node.props.style.height >= 44);
  assert.equal(node.props.accessibilityRole, 'button');
  assert.equal(node.props.accessibilityLabel, 'Add Trip');
  assert.equal(node.props.disabled, true);
});

test('the action sits in a fixed 44 pt right slot that clips anything larger', () => {
  const tree = header(addOptions(), { title: 'Saved' });
  const slots = flat(tree).filter((n) => n.type === 'View' && n.props.style?.width === SAVED_HEADER_CONTROL_SIZE && n.props.style?.height === SAVED_HEADER_CONTROL_SIZE);
  assert.equal(slots.length, 2, 'left and right slots');
  const rightSlot = slots[1];
  assert.equal(rightSlot.props.style.flexGrow, 0);
  assert.equal(rightSlot.props.style.flexShrink, 0);
  assert.equal(rightSlot.props.style.overflow, 'hidden');
  assert.ok(flat(rightSlot.children).includes(actionNode(tree)));
});

test('a greedy right-hand view (the old unsized Pressable) is still confined to the slot', () => {
  const greedy = { ...addOptions(), headerRight: () => createElement('View', { style: { alignSelf: 'stretch', flex: 1, width: 400 } }) };
  const tree = header(greedy);
  const rightSlot = flat(tree).filter((n) => n.type === 'View' && n.props.style?.width === SAVED_HEADER_CONTROL_SIZE)[1];
  assert.equal(rightSlot.props.style.width, SAVED_HEADER_CONTROL_SIZE);
  assert.equal(rightSlot.props.style.overflow, 'hidden');
  assert.equal(rightSlot.props.style.flexShrink, 0);
});

test('title is out of the row flow, centred between the slots, and cannot squeeze them', () => {
  const tree = header(addOptions(), { title: 'Saved' });
  const title = find(tree, (n) => n.type === 'Text');
  assert.deepEqual(title.children, ['Trips']);
  const wrapper = flat(tree).filter((n) => n.type === 'View' && n.children.includes(title)).at(-1);
  assert.equal(wrapper.props.style.position, 'absolute');
  assert.equal(wrapper.props.style.left, wrapper.props.style.right, 'symmetrical, so the title stays centred');
  assert.equal(title.props.numberOfLines, 1);
});

test('back control keeps its place; the safe-area inset is applied above the bar', () => {
  const tree = header(addOptions(), { title: 'Saved' });
  assert.equal(tree.props.style.paddingTop, 59);
  const back = find(tree, (n) => n.props?.accessibilityLabel === 'Go back');
  assert.ok(back, 'default back control rendered when navigation can go back');
  const custom = header({ ...addOptions(), headerLeft: () => createElement('Pressable', { accessibilityLabel: 'Custom back' }) });
  assert.ok(find(custom, (n) => n.props?.accessibilityLabel === 'Custom back'));
  const root = header(addOptions(), undefined);
  assert.equal(find(root, (n) => n.props?.accessibilityLabel === 'Go back'), undefined, 'no back control on a root screen');
});

test('with no action the right slot is empty but the header layout is the same', () => {
  const tree = header({ ...clearHeaderRightAction(), title: 'Favourites' });
  const slots = flat(tree).filter((n) => n.type === 'View' && n.props.style?.width === SAVED_HEADER_CONTROL_SIZE);
  assert.equal(slots.length, 2);
  assert.deepEqual(flat(slots[1].children), []);
});

test('add and share share one component and one size', () => {
  for (const [options, icon] of [[headerAddAction({ accessibilityLabel: 'a', onPress() {} }), 'add'], [headerShareAction({ accessibilityLabel: 'a', onPress() {} }), 'share']]) {
    assert.equal(options.header, savedActionHeader.header, 'uses the shared header');
    const node = render(options.headerRight({}));
    assert.equal(node.props.style.width, 44);
    assert.equal(node.props.style.borderRadius, 22);
    assert.equal(node.children[0].props.name, icon);
  }
  assert.equal(savedHeaderSlotStyle.width, 44);
  assert.ok(render(createElement(SavedHeaderActionButton, { action: { accessibilityLabel: 'x', onPress() {} }, icon: 'add' })));
});

test('every Saved screen with a top-right control uses the shared action helpers', async () => {
  const files = ['app/trips/index.tsx', 'app/trips/[tripId].tsx', 'app/personal-place-cards/index.tsx', 'app/notebooks/index.tsx', 'app/diaries/index.tsx'];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /headerAddAction|headerShareAction/, file);
    assert.doesNotMatch(source, /headerRight: \(\) => [^n]/, `${file} has no hand-built header action`);
    assert.doesNotMatch(source, /name="add" size=\{30\}/, file);
  }
});

test('unrelated Discover, Search and Map headers are untouched', async () => {
  for (const file of ['app/(tabs)/map.tsx', 'app/(tabs)/search.tsx', 'app/(tabs)/(discover)/index.tsx']) {
    try { assert.doesNotMatch(await read(file), /saved-header|header-actions/, file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
});

// ── Shared header on the former native-header screens ───────────────────────
const iconColour = (tree) => find(tree, (n) => n.type === 'Icon' && n.props.name === 'chevron-back').props.color;

test('screens that pass their own back control keep its colour: black for Discover, blue for Saved', () => {
  const discover = header({ headerLeft: () => createElement(HeaderBackButton, { fallbackHref: '/discover' }), title: 'Far North' }, { title: 'Discover' });
  const saved = header({ headerLeft: () => createElement(HeaderBackButton, { color: '#1473e6' }), title: 'Favourites' }, { title: 'Saved' });
  assert.equal(iconColour(discover), '#111111');
  assert.equal(iconColour(saved), '#1473e6');
});

test('a custom return handler on the back control is the one that runs', () => {
  const calls = [];
  const tree = header({ headerLeft: () => createElement(HeaderBackButton, { onPress: () => calls.push('custom') }), title: 'Place' }, { title: 'Discover' });
  find(tree, (n) => n.props?.accessibilityLabel === 'Go back').props.onPress();
  assert.deepEqual(calls, ['custom']);
});

test('while a screen is still loading (no headerLeft yet) the same single circular back control is shown', () => {
  const tree = header({ title: 'Personal Place' }, { title: 'Saved' });
  const backs = flat(tree).filter((n) => n.props?.accessibilityLabel === 'Go back');
  assert.equal(backs.length, 1);
  assert.equal(backs[0].props.style.width, 44);
  assert.equal(backs[0].props.style.borderRadius, 22);
});

test('a long title stays on one line between symmetric gutters and never squeezes the back control', () => {
  const tree = header({ headerLeft: () => createElement(HeaderBackButton, {}), title: 'Akeake Point Historic Reserve' }, { title: 'Discover' });
  const title = find(tree, (n) => n.type === 'Text');
  assert.equal(title.props.numberOfLines, 1);
  assert.deepEqual(title.children, ['Akeake Point Historic Reserve']);
  const back = find(tree, (n) => n.props?.accessibilityLabel === 'Go back');
  assert.equal(back.props.style.width, 44);
  const slot = flat(tree).filter((n) => n.type === 'View' && n.children.includes(back)).at(-1);
  assert.equal(slot.props.style.width, 44);
  assert.equal(slot.props.style.flexShrink, 0, 'the slot, not the content, is what the row cannot squeeze');
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
