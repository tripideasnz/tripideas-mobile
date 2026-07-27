import assert from 'node:assert/strict';

import {
  backFromNotebook,
  hasNotebookListHistory,
  openNotebook,
  openNotebookList,
} from './navigation.ts';

const tabs = { key: 'tabs', name: '(tabs)' };
const list = { key: 'list', name: 'notebooks/index' };
const detail = (key = 'detail') => ({
  key,
  name: 'notebooks/[notebookId]',
});

function routerFor(events, canGoBack = true) {
  return {
    back: () => events.push('back'),
    canGoBack: () => canGoBack,
    navigate: (href) => events.push(`navigate ${href}`),
    replace: (href) => events.push(`replace ${href}`),
  };
}

{
  const events = [];
  const router = routerFor(events);
  const opened = [tabs, list, detail()];

  assert.equal(hasNotebookListHistory({ index: 2, routes: opened }), true);
  assert.equal(backFromNotebook(router, { index: 2, routes: opened }), 'back');
  assert.deepEqual(events, ['back']);

  openNotebook(router, 'ucd_first');
  assert.equal(
    backFromNotebook(router, { index: 2, routes: [tabs, list, detail('again')] }),
    'back'
  );
  assert.deepEqual(events, [
    'back',
    'navigate /notebooks/ucd_first',
    'back',
  ]);
  console.log('✓ Notebook open → back → reopen → back remains stable');
}

{
  const events = [];
  const router = routerFor(events);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    openNotebook(router, `ucd_${cycle}`);
    backFromNotebook(router, {
      index: 2,
      routes: [tabs, list, detail(`detail-${cycle}`)],
    });
  }
  assert.deepEqual(
    events.filter((event) => event === 'back'),
    ['back', 'back', 'back']
  );
  assert.equal(events.filter((event) => event.startsWith('navigate ')).length, 3);
  console.log('✓ repeated Notebook navigation cycles do not depend on stale history');
}

{
  const events = [];
  const router = routerFor(events);
  const duplicateDetails = [tabs, list, detail('old'), detail('new')];

  assert.equal(
    backFromNotebook(router, { index: 3, routes: duplicateDetails }),
    'replace'
  );
  assert.deepEqual(events, ['replace /notebooks']);
  console.log('✓ duplicate detail history falls back to the Notebook list');
}

{
  const events = [];
  const router = routerFor(events, false);
  const cleanAfterSignIn = [tabs, list, detail('signed-in')];

  assert.equal(
    backFromNotebook(router, { index: 2, routes: cleanAfterSignIn }),
    'replace'
  );
  assert.deepEqual(events, ['replace /notebooks']);
  console.log('✓ Back after sign-out/sign-in has a safe list fallback');
}

{
  const events = [];
  const router = routerFor(events);

  openNotebookList(router);
  openNotebook(router, 'ucd_same');
  openNotebook(router, 'ucd_same');

  assert.deepEqual(events, [
    'navigate /notebooks',
    'navigate /notebooks/ucd_same',
    'navigate /notebooks/ucd_same',
  ]);
  assert.equal(events.some((event) => event.startsWith('push ')), false);
  console.log('✓ Notebook entry uses navigate rather than duplicate stack pushes');
}
