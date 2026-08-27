import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { generatedLinkTitle, linkSearchUrl, shouldOfferClipboardLink, validClipboardLink } from '../lib/saved-link-capture.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [capture, notebook, diary, presentation] = await Promise.all([
  read('components/ui/saved-link-capture.tsx'),
  read('app/notebooks/[notebookId].tsx'),
  read('app/diaries/[diaryId]/day.tsx'),
  read('components/ui/saved-object-presentations.tsx'),
]);

assert.equal(validClipboardLink('not a URL'), null);
assert.equal(validClipboardLink('  https://www.mountainsafety.org.nz/page  '), 'https://www.mountainsafety.org.nz/page');
assert.equal(generatedLinkTitle('https://en.wikipedia.org/wiki/Dunedin'), 'Dunedin');
assert.equal(generatedLinkTitle('https://example.com/great-walks/milford-track'), 'Milford Track');
assert.equal(generatedLinkTitle('https://www.mountainsafety.org.nz/'), 'mountainsafety.org.nz');
assert.match(linkSearchUrl(' alpine safety '), /alpine%20safety$/);
assert.equal(shouldOfferClipboardLink({ clipboard: 'https://example.com', searchActive: false, returnedFromBrowser: true, seen: new Set() }), null);
assert.equal(shouldOfferClipboardLink({ clipboard: 'https://example.com', searchActive: true, returnedFromBrowser: false, seen: new Set() }), null);
assert.equal(shouldOfferClipboardLink({ clipboard: 'plain text', searchActive: true, returnedFromBrowser: true, seen: new Set() }), null);
assert.equal(shouldOfferClipboardLink({ clipboard: 'https://example.com', searchActive: true, returnedFromBrowser: true, seen: new Set(['https://example.com']) }), null);
assert.equal(shouldOfferClipboardLink({ clipboard: 'https://example.com', searchActive: true, returnedFromBrowser: true, seen: new Set() }), 'https://example.com');

assert.match(capture, /disabled=\{!trimmed\}/);
assert.match(capture, /accessibilityState=\{\{ disabled: !trimmed \}\}/);
assert.match(capture, /const \[searchQuery, setSearchQuery\]/);
assert.match(capture, /const \[candidateUrl, setCandidateUrl\]/);
assert.match(capture, /const \[linkTitle, setLinkTitle\]/);
assert.match(capture, /if \(directUrl\) accept\(directUrl\)/);
assert.match(capture, /Use this link\?/);
assert.match(capture, /setCandidateUrl\(null\)/);
assert.match(capture, /seenClipboardValues\.current\.add\(url\)/);
assert.match(capture, /AppState\.addEventListener/);
assert.match(capture, /subscription\.remove\(\)/);
assert.match(capture, /linkTitle\.trim\(\) \|\| generatedLinkTitle/);
assert.match(capture, /accessibilityLabel="Link title"/);
assert.match(capture, /onPress=\{onCancel\}/);
assert.equal(capture.match(/label="Cancel"/g)?.length, 3);
assert.equal(capture.match(/label="Use Link"/g)?.length, 1);
assert.match(capture, /label="Change Link"[\s\S]*setSelectedUrl\(null\)/);
assert.doesNotMatch(capture.slice(capture.indexOf('if (candidateUrl)'), capture.indexOf('const trimmed')), /onSave\(/);
assert.match(capture, /onSave\(\{ title: linkTitle\.trim\(\) \|\| generatedLinkTitle\(selectedUrl\), url: selectedUrl \}\)/);
assert.doesNotMatch(capture, /onSave\([^)]*searchQuery/);
for (const screen of [notebook, diary]) assert.match(screen, /<SavedLinkCapture/);
assert.doesNotMatch(notebook, /Find a link/);
assert.doesNotMatch(diary, /Find a link/);
assert.match(presentation, /Linking\.openURL\(url\)/);
console.log('✓ shared Link capture covers direct URL, browser return, clipboard safeguards, generated titles and shared persistence adapters');
