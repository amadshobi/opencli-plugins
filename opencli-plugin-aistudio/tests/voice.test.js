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

const { voiceCommand } = await import('../voice.js');

/** Build bytes that pass the RIFF/WAVE magic gate. */
function makeWavPayload(totalSize) {
  const buf = Buffer.alloc(totalSize);
  buf.write('RIFF', 0, 'latin1');
  buf.writeUInt32LE(totalSize - 8, 4);
  buf.write('WAVE', 8, 'latin1');
  return buf;
}

function makePage({ activeVoice = 'Fola', pollStates = [], onDownloadClick = null }) {
  let pollIndex = 0;
  return {
    evaluate: vi.fn(async (script) => {
      if (script.includes('opencli:setup-editor')) return { ok: true, ready: true };
      if (script.includes('opencli:select-voice')) return true;
      if (script.includes('opencli:error-baseline')) return '';
      if (script.includes('opencli:read-voice')) return activeVoice;
      if (script.includes('opencli:fill-run')) return { ok: true };
      if (script.includes('opencli:poll-generation')) {
        const state = pollStates[Math.min(pollIndex, pollStates.length - 1)];
        pollIndex += 1;
        return state;
      }
      if (script.includes('opencli:click-download')) {
        if (onDownloadClick) onDownloadClick();
        return true;
      }
      throw new Error('Unexpected evaluate call');
    }),
  };
}

let tmpDir;
let downloadsDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMP || '.', 'oc-voice-test-'));
  downloadsDir = path.join(tmpDir, 'Downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  fixtureRoot.current = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const baseKwargs = () => ({
  text: 'Halo BOSS, ini uji suara.',
  output: '',
});

describe('aistudio voice command', () => {
  it('typed-fails when the requested persona was not applied', async () => {
    const page = makePage({ activeVoice: 'Aria' });

    await expect(voiceCommand.func(page, { ...baseKwargs(), voice: 'Fola' })).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('not applied'),
    });
  });

  it('typed-fails with the quota message when AI Studio reports a limit', { timeout: 15000 }, async () => {
    const page = makePage({
      pollStates: [{ errorText: 'Quota exceeded for this model.', isGenerating: false, hasDownloadBtn: false }],
    });

    await expect(voiceCommand.func(page, baseKwargs())).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('Rate limit'),
    });
  });

  it('captures the new download, verifies the copy, then cleans the source', { timeout: 30000 }, async () => {
    const audioPath = path.join(downloadsDir, 'Generated Audio take1.wav');
    const page = makePage({
      pollStates: [
        { errorText: '', isGenerating: true, hasDownloadBtn: false },
        { errorText: '', isGenerating: false, hasDownloadBtn: true },
      ],
      onDownloadClick: () => {
        fs.writeFileSync(audioPath, makeWavPayload(20480));
      },
    });
    const output = path.join(tmpDir, 'voice_001.wav');

    const rows = await voiceCommand.func(page, { ...baseKwargs(), output });

    expect(rows).toHaveLength(1);
    expect(rows[0].Status).toContain('verified');
    expect(fs.statSync(output).size).toBe(20480);
    expect(fs.existsSync(audioPath)).toBe(false);
  });

  it('ignores a half-written .crdownload and only captures the finished .wav', { timeout: 30000 }, async () => {
    const crdownload = path.join(downloadsDir, 'Generated Audio slow.wav.crdownload');
    fs.writeFileSync(crdownload, Buffer.alloc(30000, 3)); // half-written temp
    const finalWav = path.join(downloadsDir, 'Generated Audio slow.wav');
    const page = makePage({
      pollStates: [{ errorText: '', isGenerating: false, hasDownloadBtn: true }],
      onDownloadClick: () => {
        fs.writeFileSync(finalWav, makeWavPayload(20480)); // Chrome finishes the rename
      },
    });
    const output = path.join(tmpDir, 'voice_002.wav');

    const rows = await voiceCommand.func(page, { ...baseKwargs(), output });

    expect(rows[0].Status).toContain('verified');
    expect(fs.statSync(output).size).toBe(20480);
    // The temp file was never mistaken for the artifact
    expect(fs.existsSync(crdownload)).toBe(true);
  });

  it('refuses a non-WAV payload instead of calling it verified', { timeout: 30000 }, async () => {
    const fakeWav = path.join(downloadsDir, 'Generated Audio mp3in disguise.wav');
    const page = makePage({
      pollStates: [{ errorText: '', isGenerating: false, hasDownloadBtn: true }],
      onDownloadClick: () => {
        fs.writeFileSync(fakeWav, Buffer.concat([Buffer.from('ID3\x04 fake mp3 payload'), Buffer.alloc(20480, 5)]));
      },
    });
    const output = path.join(tmpDir, 'voice_003.wav');

    await expect(voiceCommand.func(page, { ...baseKwargs(), output })).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('not a valid WAV'),
    });
    // Source download is kept — nothing was passed off as verified
    expect(fs.existsSync(fakeWav)).toBe(true);
    expect(fs.existsSync(output)).toBe(false);
    expect(fs.existsSync(output + '.part')).toBe(false);
  });

  it('ignores files that already existed before the run', { timeout: 30000 }, async () => {
    const stale = path.join(downloadsDir, 'Generated Audio stale.wav');
    fs.writeFileSync(stale, Buffer.alloc(30000, 1));
    const page = makePage({
      pollStates: [{ errorText: '', isGenerating: false, hasDownloadBtn: true }],
    });

    await expect(voiceCommand.func(page, baseKwargs())).rejects.toMatchObject({
      code: 'COMMAND_EXEC',
      message: expect.stringContaining('no new audio file'),
    });
    // The pre-existing download must survive untouched
    expect(fs.existsSync(stale)).toBe(true);
  });
});
