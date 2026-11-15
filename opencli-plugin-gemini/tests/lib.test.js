import { describe, expect, it } from 'vitest';
import { findErrorText, isStableCapture, pickNewFile } from '../lib.js';

describe('findErrorText (gemini)', () => {
  it('flags limit / refusal lines', () => {
    expect(findErrorText("You've reached the limit for today")).toMatch(/limit/i);
    expect(findErrorText('rate limit hit')).toMatch(/rate limit/i);
    expect(findErrorText('Unable to generate the video')).toMatch(/unable to generate/i);
    expect(findErrorText('Something went wrong')).toMatch(/went\s*wrong/i);
  });

  it('returns null for normal text', () => {
    expect(findErrorText('')).toBeNull();
    expect(findErrorText('Here is your video')).toBeNull();
    expect(findErrorText(null)).toBeNull();
  });
});

describe('pickNewFile', () => {
  it('only accepts files outside the snapshot', () => {
    const entries = [{ name: 'gemini_generated_video_a.mp4' }, { name: 'gemini_generated_video_b.mp4' }];
    expect(pickNewFile(entries, new Set([entries[0].name]))).toEqual(entries[1]);
    expect(pickNewFile(entries, new Set([entries[0].name, entries[1].name]))).toBeNull();
  });
});

describe('isStableCapture', () => {
  it('requires equal consecutive samples above the floor', () => {
    expect(isStableCapture(1048576, 1048576, 1048576)).toBe(true);
    expect(isStableCapture(999, 999, 1048576)).toBe(false);
  });
});
