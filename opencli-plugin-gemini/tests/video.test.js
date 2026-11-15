import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const fixtureRoot = vi.hoisted(() => ({
  current: '',
}));

vi.mock('node:os', () => ({
  homedir: () => fixtureRoot.current,
  default: { homedir: () => fixtureRoot.current },
}));

const { videoCommand } = await import('../video.js');

function makePage({ pollStates = [], onPollClick = null }) {
  let pollIndex = 0;
  return {
    goto: vi.fn(async () => {}),
    evaluate: vi.fn(async (script) => {
      if (script.includes('opencli:check-page')) return true;
      if (script.includes('opencli:mark-buttons')) return true;
      if (script.includes('opencli:error-baseline')) return '';
      if (script.includes('opencli:count-download')) return 0;
      if (script.includes('opencli:fill-prompt')) return { ok: true, via: 'button' };
      if (script.includes('opencli:poll')) {
        const state = pollStates[Math.min(pollIndex, pollStates.length - 1)];
        pollIndex += 1;
        if (state.clicked && onPollClick) onPollClick();
        return state;
      }
      throw new Error('Unexpected evaluate call');
    }),
  };
}

let tmpDir;
let downloadsDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMP || '.', 'oc-gemini-test-'));
  downloadsDir = path.join(tmpDir, 'Downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  fixtureRoot.current = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const baseKwargs = () => ({
  prompt: 'an ant surviving a fall, 3D animation',
  output: '',
  timeout: 60,
  downloadWait: 5,
  new: false,
});

describe('gemini video command', () => {
  it('typed-fails when Gemini reports a limit', { timeout: 30000 }, async () => {
    const page = makePage({
      pollStates: [{ errorText: "You've reached the limit for today", clicked: false }],
    });

    await expect(videoCommand.func(page, baseKwargs())).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('Rate limit'),
    });
  });

  it('typed-fails when the composer cannot be used', async () => {
    const page = makePage({});
    page.evaluate.mockImplementation(async (script) => {
      if (script.includes('opencli:check-page')) return true;
      if (script.includes('opencli:mark-buttons')) return true;
      if (script.includes('opencli:error-baseline')) return '';
      if (script.includes('opencli:count-download')) return 0;
      if (script.includes('opencli:fill-prompt')) return { ok: false, error: 'Gemini composer not found' };
      throw new Error('Unexpected evaluate call');
    });

    await expect(videoCommand.func(page, baseKwargs())).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('Could not send prompt'),
    });
  });

  it('captures the new download, verifies the copy, then cleans the source', { timeout: 30000 }, async () => {
    const videoPath = path.join(downloadsDir, 'gemini_generated_video_2026-11-16.mp4');
    const page = makePage({
      pollStates: [
        { errorText: '', clicked: false },
        { errorText: '', clicked: true },
      ],
      onPollClick: () => {
        fs.writeFileSync(videoPath, Buffer.alloc(1250000, 9));
      },
    });
    const output = path.join(tmpDir, 'shot_001.mp4');

    const rows = await videoCommand.func(page, { ...baseKwargs(), output });

    expect(rows).toHaveLength(1);
    expect(rows[0].Status).toContain('verified');
    expect(fs.statSync(output).size).toBe(1250000);
    expect(fs.existsSync(videoPath)).toBe(false);
  });

  it('ignores pre-existing downloads and keeps them on failure', { timeout: 30000 }, async () => {
    const stale = path.join(downloadsDir, 'gemini_generated_video_old.mp4');
    fs.writeFileSync(stale, Buffer.alloc(1250000, 1));
    const page = makePage({
      pollStates: [{ errorText: '', clicked: true }],
    });

    await expect(videoCommand.func(page, baseKwargs())).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('no new video file'),
    });
    expect(fs.existsSync(stale)).toBe(true);
  });
});
