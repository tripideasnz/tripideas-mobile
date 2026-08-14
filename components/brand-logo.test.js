import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [brandLogo, cover, discover] = await Promise.all([
  readFile(new URL('./brand-logo.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/(tabs)/(discover)/discover.tsx', import.meta.url), 'utf8'),
]);

assert.match(brandLogo, /tripideasnz-dark\.png/);
assert.match(brandLogo, /tripideasnz-light\.png/);
assert.match(brandLogo, /aspectRatio: 2172 \/ 724/);
assert.match(cover, /<BrandLogo[\s\S]*tone="light"/);
assert.doesNotMatch(cover, /cover\?\.logoUrl \? \(/);
assert.match(discover, /onLogoPress=\{\(\) => router\.push\('\/'\)\}/);

console.log('✓ authoritative Tripideasnz artwork is used on Discover and the cover');
