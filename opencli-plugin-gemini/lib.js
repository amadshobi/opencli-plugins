/**
 * Shared pure helpers for the gemini plugin commands.
 * Everything here must be testable without a browser or filesystem.
 */

/** Sanity floor for a downloaded video file (bytes). */
export const MIN_VIDEO_BYTES = 1024 * 1024;
/** How long to wait for a download to land and stabilise (ms). */
export const DOWNLOAD_WAIT_MS = 120000;

/**
 * Patterns that indicate a rate limit / quota / generation refusal in the
 * Gemini App UI. Only error-ish containers are scanned by the caller.
 */
export const ERROR_PATTERNS = [
  /reach(ed)?\s*(your|the|a|their)?\s*limit/i,
  /rate\s*limit/i,
  /quota/i,
  /resource[\s-]*exhausted/i,
  /daily\s*(limit|quota)/i,
  /unable\s*to\s*(generate|create)/i,
  /can'?t\s*(generate|create)/i,
  /couldn'?t\s*(generate|create)/i,
  /something\s*went\s*wrong/i,
  /try\s*again\s*(later|in|tomorrow)/i,
  /temporarily\s*unavailable/i,
];

/**
 * Find the first limit / error line in a text sample.
 * Returns the matched line (trimmed) or null when nothing matches.
 */
export function findErrorText(sample) {
  if (typeof sample !== 'string' || sample.length === 0) return null;
  const lines = sample.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(line)) return line;
    }
  }
  return null;
}

/**
 * Pick the first download file that was NOT present in the before-snapshot.
 * Returns the entry or null.
 */
export function pickNewFile(entries, snapshotNames) {
  if (!Array.isArray(entries)) return null;
  const seen = snapshotNames instanceof Set ? snapshotNames : new Set(snapshotNames ?? []);
  return entries.find((entry) => entry && entry.name && !seen.has(entry.name)) ?? null;
}

/**
 * A captured download is only accepted once its size stops growing:
 * two consecutive samples must be equal and above minBytes.
 */
export function isStableCapture(firstSize, secondSize, minBytes) {
  return (
    Number.isFinite(firstSize) &&
    firstSize === secondSize &&
    firstSize >= minBytes
  );
}
