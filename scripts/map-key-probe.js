// Optional MapTiler diagnostic, shared by the two release scripts: asks MapTiler whether it still
// accepts the key for the map styles the app uses. It is deliberately NOT a gate: a MapTiler or
// network outage must not stop an otherwise valid build, so callers report the answers as notes and
// warnings only. The key is the approved one, checked by fingerprint elsewhere (config/release-endpoints.js).
// Nothing here prints the key or the URL: results carry the style name and an HTTP status or a reason.
'use strict';

const STYLES = ['streets-v2', 'satellite'];

async function probeMapStyles(key, fetchImpl = fetch, timeoutMs = 8000) {
  const results = [];
  for (const style of STYLES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`https://api.maptiler.com/maps/${style}/style.json?key=${key}`, { signal: controller.signal });
      results.push({ status: response.status, style });
    } catch (error) {
      results.push({ reason: error?.name === 'AbortError' ? 'timed out' : 'could not be reached', style });
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}

/** Splits probe results into { notes, warnings } (an answer other than HTTP 200 is a warning, never an error). */
function describeProbe(results) {
  const notes = [];
  const warnings = [];
  for (const { reason, status, style } of results) {
    if (status === 200) notes.push(`MapTiler ${style} style: HTTP 200 (diagnostic)`);
    else warnings.push(`MapTiler ${style} style ${reason ?? `answered HTTP ${status}`} (diagnostic only: this does not fail the build).`);
  }
  return { notes, warnings };
}

module.exports = { describeProbe, probeMapStyles };
