import assert from 'node:assert/strict';

import {
  backFromNotebookDetail,
  backFromNotebookList,
  openNotebook,
  openNotebookList,
} from './navigation.ts';

function createRouter(initialRoutes = ['/saved']) {
  const routes = [...initialRoutes];
  const events = [];

  return {
    dismissTo(href) {
      events.push(`dismissTo ${href}`);
      const targetIndex = routes.lastIndexOf(href);
      if (targetIndex >= 0) {
        routes.splice(targetIndex + 1);
      } else if (routes.length > 0) {
        routes[routes.length - 1] = href;
      } else {
        routes.push(href);
      }
    },
    events,
    push(href) {
      events.push(`push ${href}`);
      routes.push(href);
    },
    routes,
  };
}

function runFullCycle(router, notebookId) {
  openNotebookList(router);
  openNotebook(router, notebookId);
  backFromNotebookDetail(router);
  assert.deepEqual(router.routes, ['/saved', '/notebooks']);
  backFromNotebookList(router);
  assert.deepEqual(router.routes, ['/saved']);
}

{
  const router = createRouter();
  openNotebookList(router);
  openNotebook(router, 'ucd_first');
  backFromNotebookDetail(router);
  assert.deepEqual(router.routes, ['/saved', '/notebooks']);
  console.log('✓ detail Back returns to the Notebooks list');

  backFromNotebookList(router);
  assert.deepEqual(router.routes, ['/saved']);
  console.log('✓ Notebooks Back returns to Saved');
}

{
  const router = createRouter();
  runFullCycle(router, 'ucd_first');
  runFullCycle(router, 'ucd_second');
  assert.equal(
    router.events.filter((event) => event === 'dismissTo /notebooks').length,
    2
  );
  console.log('✓ second detail Back handler fires and completes');
}

{
  const router = createRouter();
  for (let cycle = 0; cycle < 6; cycle += 1) {
    runFullCycle(router, `ucd_${cycle}`);
    assert.equal(new Set(router.routes).size, router.routes.length);
  }
  assert.deepEqual(router.routes, ['/saved']);
  console.log('✓ repeated cycles do not accumulate duplicate routes');
}

{
  const router = createRouter(['/notebooks/ucd_deep_link']);
  backFromNotebookDetail(router);
  assert.deepEqual(router.routes, ['/notebooks']);
  console.log('✓ direct detail entry falls back to the Notebooks list');
}

{
  const router = createRouter(['/notebooks/ucd_before_sign_out']);
  backFromNotebookDetail(router);
  router.routes.splice(0, router.routes.length, '/saved');
  runFullCycle(router, 'ucd_after_sign_in');
  assert.deepEqual(router.routes, ['/saved']);
  console.log('✓ Back remains deterministic after sign-out and sign-in');
}

{
  const router = createRouter([
    '/saved',
    '/notebooks',
    '/notebooks/ucd_duplicate',
    '/notebooks/ucd_duplicate',
  ]);
  backFromNotebookDetail(router);
  assert.deepEqual(router.routes, ['/saved', '/notebooks']);
  console.log('✓ detail Back removes duplicate detail entries');
}
