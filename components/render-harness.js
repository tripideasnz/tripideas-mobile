// Test support (not a test): renders the real presentational components to a plain element tree with
// the native modules and a few heavy children replaced by inert stand-ins, so tests can inspect what
// a screen shows and what pressing a control does. How it looks is for the Simulator.
import { register } from 'node:module';

const stubSource = `
const base = BASE_URL;
const stubs = ['react-native', '@expo/vector-icons/MaterialIcons', '@/components/place-card', '@/components/ui/show-more-text', '@/components/ui/autosave-note', '@/components/ui/icon-action', '@/components/trip-image-collage'];
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (stubs.includes(specifier)) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const h = "const h = (t) => (p) => createElement(t, p);";
  const sources = {
    'react-native': \`import { createElement } from 'react'; \${h} export const View = h('View'); export const Text = h('Text'); export const Pressable = h('Pressable'); export const ScrollView = h('ScrollView'); export const ActivityIndicator = h('ActivityIndicator'); export const RefreshControl = h('RefreshControl'); export const Alert = { alert: (title, message, buttons) => globalThis.__alerts.push({ buttons, message, title }) };\`,
    '@expo/vector-icons/MaterialIcons': \`import { createElement } from 'react'; export default (p) => createElement('MaterialIcons', p);\`,
    '@/components/place-card': \`import { createElement } from 'react'; export const PlaceCard = (p) => createElement('PlaceCard', p);\`,
    '@/components/ui/show-more-text': \`import { createElement } from 'react'; export const ShowMoreText = (p) => createElement('ShowMoreText', p);\`,
    '@/components/ui/autosave-note': \`import { createElement } from 'react'; export const AutosaveNote = (p) => createElement('AutosaveNote', p);\`,
    '@/components/ui/icon-action': \`import { createElement } from 'react'; export const IconAction = (p) => createElement('IconAction', p);\`,
    '@/components/trip-image-collage': \`import { createElement } from 'react'; export const TripImageCollage = (p) => createElement('TripImageCollage', p);\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[url.slice(5)] };
}
`;
globalThis.__alerts = [];
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

export const alerts = globalThis.__alerts;

export const render = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (Array.isArray(node)) return node.map(render).filter((child) => child !== null);
  if (typeof node !== 'object') return node;
  const { type, props } = node;
  if (typeof type === 'function') return render(type(props));
  const kids = render(props.children);
  return { children: kids === null ? [] : [kids].flat(Infinity), props, type };
};
export const walk = (tree, visit) => {
  if (!tree || typeof tree !== 'object') return;
  visit(tree);
  tree.children.forEach((child) => walk(child, visit));
};
export const findAll = (tree, predicate) => {
  const found = [];
  walk(tree, (node) => { if (predicate(node)) found.push(node); });
  return found;
};
export const find = (tree, predicate) => findAll(tree, predicate)[0];
export const textOf = (tree) => {
  const parts = [];
  const visit = (node) => {
    if (typeof node === 'string') parts.push(node);
    else if (node && typeof node === 'object') node.children.forEach(visit);
  };
  visit(tree);
  return parts.join('');
};
export const byLabel = (label) => (node) => node.props?.accessibilityLabel === label;
export const buttons = (tree) => findAll(tree, (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
export const buttonByText = (tree, label) => buttons(tree).find((node) => textOf(node) === label);
export const press = (node) => node.props.onPress();
export const { createElement } = await import('react');
