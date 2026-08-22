const test = require('node:test');
const assert = require('node:assert/strict');
require('typescript');

test('rich object source keeps backwards-compatible defaults and supported link parser', () => {
  const fs = require('node:fs');
  const registry = fs.readFileSync(require.resolve('../content-blocks/registry.ts'), 'utf8');
  assert.match(registry, /block\.type !== 'link'/);
  assert.match(registry, /isImportant: block\.isImportant === true/);
  assert.match(registry, /location: block\.location == null \? null/);
});

test('foreground location helper uses one current fix and no watcher', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../location/foreground.ts'), 'utf8');
  assert.match(source, /getCurrentPositionAsync/);
  assert.doesNotMatch(source, /watchPositionAsync|startLocationUpdatesAsync|requestBackgroundPermissionsAsync/);
});
