import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const { videoCommand } = await import('../video.js');

function makePage(states) {
  let pollIndex = 0;
  let chunkIndex = 0;
  return {
    evaluate: vi.fn(async (script) => {
      if (script.includes('opencli:model-setup')) return { ok: true, switched: false };
      if (script.includes('opencli:mark-videos')) return true;
      if (script.includes('opencli:error-baseline')) return '';
      if (script.includes('opencli:unmark-newest')) return true;
      if (script.includes('opencli:cleanup-bytes')) return true;
      if (script.includes('opencli:fill-prompt')) return { ok: true };
      if (script.includes('opencli:poll')) {
        const state = states[Math.min(pollIndex, states.length - 1)];
        pollIndex += 1;
        return state;
      }
      if (script.includes('opencli:stash-bytes')) {
        return { ok: true, len: 1250000, chunks: 5 };
      }
      if (script.includes('opencli:read-chunk')) {
        chunkIndex += 1;
        return Buffer.alloc(250000, 65).toString('base64');
      }
      throw new Error('Unexpected evaluate call');
    }),
  };
}

const baseKwargs = () => ({
  prompt: 'an ant falling from a building in slow motion',
  output: '',
  model: 'gemini-omni-1.2-flash',
  timeout: 60,
});

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-video-test-'));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('aistudio video command', () => {
  it('typed-fails with the limit message when AI Studio reports a rate limit', { timeout: 30000 }, async () => {
    const page = makePage([
      { errorText: 'Rate limit exceeded. Try again later.', isGenerating: false, video: { found: false } },
    ]);

    await expect(videoCommand.func(page, baseKwargs())).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('Rate limit'),
    });
  });

  it('extracts, writes and verifies the fresh video on success', { timeout: 30000 }, async () => {
    const page = makePage([
      { errorText: '', isGenerating: true, video: { found: false } },
      {
        errorText: '',
        isGenerating: false,
        video: { found: true, duration: 10.03, width: 1280, height: 720, readyState: 4 },
      },
    ]);
    const kwargs = { ...baseKwargs(), output: path.join(tmpDir, 'shot_001.mp4') };

    const rows = await videoCommand.func(page, kwargs);

    expect(rows).toHaveLength(1);
    expect(rows[0].Status).toContain('verified');
    expect(fs.statSync(kwargs.output).size).toBe(1250000);
  });

  it('never destroys a pre-existing file when extraction fails mid-write', { timeout: 45000 }, async () => {
    const output = path.join(tmpDir, 'shot_002.mp4');
    fs.writeFileSync(output, Buffer.alloc(64, 1)); // a good file from a previous run
    const page = makePage([
      {
        errorText: '',
        isGenerating: false,
        video: { found: true, duration: 10.03, width: 1280, height: 720, readyState: 4 },
      },
    ]);
    // stash succeeds (full size) but every chunk read blows up mid-write
    page.evaluate.mockImplementation(async (script) => {
      if (script.includes('opencli:model-setup')) return { ok: true, switched: false };
      if (script.includes('opencli:mark-videos')) return true;
      if (script.includes('opencli:error-baseline')) return '';
      if (script.includes('opencli:unmark-newest')) return true;
      if (script.includes('opencli:cleanup-bytes')) return true;
      if (script.includes('opencli:fill-prompt')) return { ok: true };
      if (script.includes('opencli:poll')) {
        return { errorText: '', isGenerating: false, video: { found: false } };
      }
      if (script.includes('opencli:stash-bytes')) return { ok: true, len: 1250000, chunks: 5 };
      if (script.includes('opencli:read-chunk')) throw new Error('page closed');
      throw new Error('Unexpected evaluate call');
    });
    const kwargs = { ...baseKwargs(), output, timeout: 15 };

    await expect(videoCommand.func(page, kwargs)).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('Timeout'),
    });
    // The previous good file survives; no .part debris is left behind
    expect(fs.statSync(output).size).toBe(64);
    expect(fs.existsSync(output + '.part')).toBe(false);
  });

  it('typed-fails when the model card cannot be selected', async () => {
    const page = makePage([]);
    page.evaluate.mockImplementation(async (script) => {
      if (script.includes('opencli:model-setup')) return { ok: false, error: 'Model card not found' };
      throw new Error('Unexpected evaluate call');
    });

    await expect(videoCommand.func(page, baseKwargs())).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('Model setup failed'),
    });
  });
});
