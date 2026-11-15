/**
 * Shared pure helpers for the aistudio plugin commands.
 * Everything here must be testable without a browser or filesystem.
 */

/** Sanity floor for extracted video files (bytes). */
export const MIN_VIDEO_BYTES = 1024 * 1024;
/** A real AI Studio clip is ~10s; anything shorter is a preview/partial. */
export const MIN_VIDEO_DURATION_S = 3;
/** Sanity floor for captured audio files (bytes). */
export const MIN_AUDIO_BYTES = 10 * 1024;
/** Chunk size used when hauling video bytes out of the page (bytes). */
export const VIDEO_CHUNK_SIZE = 250000;

/**
 * Patterns that indicate a rate limit / quota / transient provider error in
 * AI Studio UI error containers. Only containers that exist to surface
 * errors are scanned (never the whole page body, which may legitimately
 * mention limits in model descriptions).
 */
export const ERROR_PATTERNS = [
  /rate\s*limit/i,
  /quota/i,
  /resource[\s-]*exhausted/i,
  /limit\s*(has\s*)?been\s*(reached|exceeded)/i,
  /reach(ed)?\s*(your|the|a|their)?\s*limit/i,
  /requests?\s*exceeded/i,
  /too\s*many\s*requests/i,
  /daily\s*(limit|quota)/i,
  /try\s*again\s*(later|in|tomorrow)/i,
  /temporarily\s*unavailable/i,
  /service\s*capacity/i,
];

/**
 * Find the first rate-limit / quota style error in a text sample.
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

/** How many fixed-size chunks are needed to move byteLength bytes. */
export function chunkCount(byteLength, chunkSize = VIDEO_CHUNK_SIZE) {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return 0;
  return Math.ceil(byteLength / chunkSize);
}

/**
 * Pick the first download file that was NOT present in the before-snapshot.
 * `entries` is an array of { name, mtimeMs, size }; the caller sorts it.
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
