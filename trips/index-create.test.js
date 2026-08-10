import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screen = await readFile(
  new URL('../app/trips/index.tsx', import.meta.url),
  'utf8'
);

assert.match(screen, /try \{[\s\S]*await createTrip\(newTripName\);[\s\S]*\} catch \(error\) \{/);
assert.match(screen, /Could not create the Trip\$\{tripRequestDiagnostic\(error\)\}/);
assert.match(screen, /createError \? <AppText color=\{Palette\.danger\}/);

console.log('✓ Trips index contains create-only API failures inline');
