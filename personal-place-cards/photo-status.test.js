import assert from 'node:assert/strict';

import { failedPhotoUploadMessage } from './photo-status.ts';

assert.equal(failedPhotoUploadMessage(0), null);
assert.equal(failedPhotoUploadMessage(1), '1 photo failed to upload');
assert.equal(failedPhotoUploadMessage(2), '2 photos failed to upload');
console.log('✓ Personal Place failed-photo status uses clear singular and plural copy');
