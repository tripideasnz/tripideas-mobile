import assert from 'node:assert/strict';

import { backFromNotebookDetail, backFromNotebookList, openNotebook, openNotebookList } from './navigation.ts';

function createRouter(initialRoutes = ['/saved']) {
  const routes = [...initialRoutes];
  const events = [];
  return {
    back() { events.push('back'); routes.pop(); },
    canGoBack() { return routes.length > 1; },
    events,
    push(href) { events.push(`push ${href}`); routes.push(href); },
    replace(href) { events.push(`replace ${href}`); routes[routes.length - 1] = href; },
    routes,
  };
}

{
  const router = createRouter();
  openNotebookList(router);
  openNotebook(router, 'ucd_history');
  backFromNotebookDetail(router);
  assert.deepEqual(router.routes, ['/saved', '/notebooks']);
  backFromNotebookList(router);
  assert.deepEqual(router.routes, ['/saved']);
  assert.deepEqual(router.events.slice(-2), ['back', 'back']);
  console.log('✓ Saved → Notebooks → Notebook unwinds through actual history');
}

{
  const router = createRouter(['/notebooks/ucd_deep_link']);
  backFromNotebookDetail(router);
  assert.deepEqual(router.routes, ['/notebooks']);
  assert.equal(router.events.at(-1), 'replace /notebooks');
  console.log('✓ direct Notebook entry uses the explicit Notebooks fallback');
}

{
  const router = createRouter(['/notebooks']);
  backFromNotebookList(router);
  assert.deepEqual(router.routes, ['/saved']);
  assert.equal(router.events.at(-1), 'replace /saved');
  console.log('✓ direct Notebook index entry uses the explicit Saved fallback');
}

{
  const router = createRouter(['/saved', '/notebooks', '/notebooks/ucd_1', '/place/editorial']);
  router.back();
  assert.deepEqual(router.routes, ['/saved', '/notebooks', '/notebooks/ucd_1']);
  console.log('✓ a Notebook child detail returns to the same Notebook stack entry');
}
