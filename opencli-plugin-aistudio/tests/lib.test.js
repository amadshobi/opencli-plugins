import { describe, expect, it } from 'vitest';
import {
  chunkCount,
  findErrorText,
  isStableCapture,
  pickNewFile,
  VIDEO_CHUNK_SIZE,
} from '../lib.js';

describe('findErrorText', () => {
  it('flags rate limit / quota lines', () => {
    expect(findErrorText('\nRate limit exceeded. Try again later.\n')).toMatch(/rate limit/i);
    expect(findErrorText('daily quota exhausted for this model')).toMatch(/quota/i);
    expect(findErrorText('You have reached your limit')).toMatch(/limit/i);
    expect(findErrorText('resource-exhausted')).toMatch(/exhausted/i);
    expect(findErrorText('temporarily unavailable')).toMatch(/unavailable/i);
  });

  it('returns null for normal text', () => {
    expect(findErrorText('')).toBeNull();
    expect(findErrorText(null)).toBeNull();
    expect(findErrorText('Video generated successfully')).toBeNull();
    expect(findErrorText('Model supports up to 10s clips')).toBeNull();
  });
});

describe('chunkCount', () => {
  it('handles boundaries', () => {
    expect(chunkCount(0)).toBe(0);
    expect(chunkCount(-5)).toBe(0);
    expect(chunkCount(1)).toBe(1);
    expect(chunkCount(VIDEO_CHUNK_SIZE)).toBe(1);
    expect(chunkCount(VIDEO_CHUNK_SIZE + 1)).toBe(2);
    expect(chunkCount(1024 * 1024)).toBe(5);
  });
});

describe('pickNewFile', () => {
  const entries = [
    { name: 'Generated Audio a.wav', size: 10 },
    { name: 'Generated Audio b.wav', size: 20 },
  ];

  it('skips everything present in the snapshot', () => {
    expect(pickNewFile(entries, new Set(['Generated Audio a.wav', 'Generated Audio b.wav']))).toBeNull();
  });

  it('returns the first file outside the snapshot', () => {
    expect(pickNewFile(entries, new Set(['Generated Audio a.wav']))).toEqual(entries[1]);
    expect(pickNewFile(entries, new Set())).toEqual(entries[0]);
    expect(pickNewFile(null, new Set())).toBeNull();
  });
});

describe('isStableCapture', () => {
  it('requires two equal samples above the floor', () => {
    expect(isStableCapture(2048, 2048, 1024)).toBe(true);
    expect(isStableCapture(2048, 4096, 1024)).toBe(false);
    expect(isStableCapture(512, 512, 1024)).toBe(false);
    expect(isStableCapture(NaN, NaN, 1024)).toBe(false);
  });
});
