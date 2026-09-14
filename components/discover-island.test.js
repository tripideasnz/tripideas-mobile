import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual IslandCard handlers and state, without mounting native UI.
const source = readFileSync(new URL('../app/(tabs)/(discover)/discover.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(`${source}\nexport { IslandCard };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const jsx = (type, props) => ({ type, props });
const noNavigation = () => { throw new Error('Island image/title must expand in place, never navigate'); };

for (const slug of ['north', 'south']) {
  let expanded = false;
  let openCalls = 0;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return { useState: () => [expanded, (value) => { expanded = value; }] };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'expo-router') return { useRouter: noNavigation, router: { push: noNavigation }, Link: 'Link' };
      if (name === '@/constants/design') return { Palette: {}, Radius: {}, Space: {}, Type: {} };
      return new Proxy({}, { get: (_, key) => key });
    },
  });
  const props = {
    island: { slug, title: `${slug} Island`, imageUrl: 'island-image', regions: [{ _id: `${slug}-region`, name: 'Region' }] },
    cardHeight: 200, imageHeight: 130, expandedImageHeight: 180,
    onOpen: () => openCalls++,
  };
  const render = () => {
    const tree = exports.IslandCard(props);
    const children = tree.props.children;
    const image = children.find((node) => node?.type === 'Pressable' && node.props.style?.position === 'absolute');
    const title = children.find((node) => node?.type === 'Pressable' && typeof node.props.style === 'function');
    assert.ok(image && title);
    assert.equal(image.props.onPress, title.props.onPress, `${slug}: both must use the identical handler`);
    assert.equal(image.props.accessibilityState.expanded, expanded);
    assert.equal(title.props.accessibilityState.expanded, expanded);
    assert.equal(children[0].type, 'MediaFrame', 'no visible image wrapper added');
    assert.equal(image.props.style.height, children[0].props.style.height);
    return { image, title, children };
  };
  let current = render();
  assert.equal(current.children.at(-1), null, 'regions start collapsed');
  current.image.props.onPress();
  current = render();
  assert.equal(expanded, true, `${slug}: image expands`);
  assert.equal(openCalls, 1);
  const rows = current.children.at(-1).props.children;
  assert.equal(rows[0].type.name, 'RegionSection', 'expansion displays existing region rows in place');
  current.title.props.onPress();
  current = render();
  assert.equal(expanded, false, `${slug}: title collapses image-opened section`);
  assert.equal(openCalls, 1, 'closing does not invoke open/scroll callback');
  current.title.props.onPress();
  current = render();
  assert.equal(expanded, true, `${slug}: title expands`);
  assert.equal(openCalls, 2);
  current.image.props.onPress();
  current = render();
  assert.equal(expanded, false, `${slug}: image collapses title-opened section`);
  assert.equal(current.children.at(-1), null);
  assert.equal(openCalls, 2);
}
console.log('✓ North/South image and title share the same in-place expansion handler and never navigate');
