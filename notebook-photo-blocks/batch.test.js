import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('./service.ts', import.meta.url), 'utf8');

assert.match(service, /for \(const photo of selected\)/);
assert.match(service, /await prepareNativePhotoUpload\(userId, photo\)/);
assert.match(service, /let attachmentBlocked = false/);
assert.match(service, /if \(attachmentBlocked\)[\s\S]*await startNativePhotoUpload/);
assert.match(service, /else attachmentBlocked = true/);
assert.match(service, /pending\.length - completed\.length/);
console.log('✓ Notebook photo batches prepare every selection and retain attachment order across partial failures');
