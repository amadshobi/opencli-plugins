import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { findErrorText, isStableCapture, MIN_AUDIO_BYTES, pickNewFile } from './lib.js';

/** List downloadable audio artifacts currently sitting in the Downloads folder. */
function listAudioEntries(downloadsDir) {
  try {
    return fs
      .readdirSync(downloadsDir)
      // Only finished downloads qualify — a `.crdownload` temp file would
      // otherwise pass the size-stability check mid-write and get captured.
      .filter((name) => name.startsWith('Generated Audio') && name.endsWith('.wav'))
      .map((name) => {
        const fullPath = path.join(downloadsDir, name);
        try {
          const stat = fs.statSync(fullPath);
          return { name, path: fullPath, mtimeMs: stat.mtimeMs, size: stat.size };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

export const voiceCommand = cli({
  site: 'aistudio',
  name: 'voice',
  description: 'Generate speech/voice audio using Gemini 3.8 Flash TTS in AI Studio Web without API key',
  access: 'write',
  domain: 'aistudio.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  navigateBefore: 'https://aistudio.google.com/generate-speech?model=gemini-3.8-flash-tts',
  columns: ['Model', 'Voice', 'Text', 'Output', 'Size', 'Status'],
  args: [
    {
      name: 'text',
      positional: true,
      required: false,
      help: 'Text to synthesize into speech (supports tags like <laugh>, <sigh>, <gasp>)',
    },
    {
      name: 'voice',
      positional: false,
      required: false,
      help: 'Voice persona name: Fola, Enya, Bodi, Lumi, Sola, or any of 2,000+ voices',
    },
    {
      name: 'output',
      positional: false,
      required: false,
      help: 'Output audio file path (default: ./speech.wav)',
    },
    {
      name: 'timeout',
      type: 'int',
      default: 90,
      help: 'Max seconds to wait for audio generation (default: 90)',
    },
  ],
  func: async (page, kwargs) => {
    const speechText = String(kwargs.text || 'Halo BOSS, ini suara resmi Gemini 3.8 Flash TTS langsung dari terminal!');
    const requestedVoice = kwargs.voice ? String(kwargs.voice).trim() : null;
    const outputPath = path.resolve(String(kwargs.output || './speech.wav'));
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const maxTimeoutSec = Number(kwargs.timeout || 90);

    // 1. Ensure we are in the Dialog editor
    const setupResult = await page.evaluate(`(async () => {
      /* opencli:setup-editor */
      let ta = document.querySelector('textarea[aria-label="Speech block text"]') || document.querySelector('textarea');
      if (ta) return { ok: true, ready: true };

      const card = document.querySelector('mat-card.create-dialog-card')
        || Array.from(document.querySelectorAll('mat-card, [role="button"], button')).find((el) => (el.innerText || '').includes('Create new dialog'));
      if (card) {
        card.click();
        await new Promise((r) => setTimeout(r, 1200));
      }

      for (let i = 0; i < 15; i += 1) {
        ta = document.querySelector('textarea[aria-label="Speech block text"]') || document.querySelector('textarea');
        if (ta && !ta.disabled) return { ok: true, ready: true };
        await new Promise((r) => setTimeout(r, 400));
      }

      return { ok: false, error: 'Could not open speech dialog editor' };
    })()`);
    if (!setupResult?.ok) {
      throw new CommandExecutionError(`Editor setup failed: ${setupResult?.error || 'speech dialog not reachable'}`);
    }

    // 2. Select the requested voice persona (best effort — verified below)
    if (requestedVoice) {
      await page.evaluate(`(async () => {
        /* opencli:select-voice */
        const speakerBtn = Array.from(document.querySelectorAll('button')).find((el) => (el.innerText || '').includes('Speaker 1'));
        if (speakerBtn && !(speakerBtn.innerText || '').toLowerCase().includes(${JSON.stringify(requestedVoice.toLowerCase())})) {
          speakerBtn.click();
          await new Promise((r) => setTimeout(r, 800));

          const overlay = document.querySelector('.cdk-overlay-container');
          if (overlay) {
            const input = overlay.querySelector('input');
            if (input) {
              input.value = ${JSON.stringify(requestedVoice)};
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise((r) => setTimeout(r, 900));

              const targetVoice = Array.from(overlay.querySelectorAll('*')).find((el) =>
                el.childElementCount === 0 && (el.innerText || '').trim().toLowerCase() === ${JSON.stringify(requestedVoice.toLowerCase())});
              if (targetVoice) {
                const clickable = targetVoice.closest('button, [role="button"], div[tabindex]') || targetVoice;
                clickable.click();
                await new Promise((r) => setTimeout(r, 600));
              }
            }

            const closeBtn = Array.from(overlay.querySelectorAll('button')).find((b) => (b.innerText || '').includes('close'));
            if (closeBtn) closeBtn.click();
            await new Promise((r) => setTimeout(r, 600));
          }
        }
        return true;
      })()`);
    }

    // 3. Verify the voice actually applied — a silent persona swap ruins a video
    const activeVoice = await page.evaluate(`(() => {
      /* opencli:read-voice */
      const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.innerText || '').includes('Speaker 1'));
      return btn ? btn.innerText.replace('arrow_drop_down', '').replace('Speaker 1 -', '').trim() : 'unknown';
    })()`);
    if (requestedVoice && !String(activeVoice).toLowerCase().includes(requestedVoice.toLowerCase())) {
      throw new CommandExecutionError(
        `Voice "${requestedVoice}" was not applied (active voice: "${activeVoice}"). ` +
        'Refusing to synthesize with the wrong persona.',
      );
    }

    // 4. Snapshot the Downloads folder BEFORE running (race protection)
    const snapshot = new Set(listAudioEntries(downloadsDir).map((entry) => entry.name));

    // 4b. Baseline the error containers — stale banners from earlier runs on
    // this persistent tab must never abort the current synthesis
    const errorBaseline = await page.evaluate(`(() => {
      /* opencli:error-baseline */
      const nodes = document.querySelectorAll(
        '[role="alert"], .mat-snack-bar-container, snackbar-container, [aria-live="assertive"], .error-message, .error-container'
      );
      let text = '';
      nodes.forEach((n) => { text += '\\n' + (n.innerText || n.textContent || ''); });
      return text.slice(0, 2000);
    })()`);

    // 5. Set speech text & trigger Run
    const runResult = await page.evaluate(`(async () => {
      /* opencli:fill-run */
      const ta = document.querySelector('textarea[aria-label="Speech block text"]') || document.querySelector('textarea');
      if (!ta) return { ok: false, error: 'Speech textarea not found' };

      ta.value = ${JSON.stringify(speechText)};
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 600));

      const runBtn = document.querySelector('button.ctrl-enter-submits')
        || Array.from(document.querySelectorAll('button')).find((b) => (b.innerText || '').startsWith('Run'));
      if (!runBtn) return { ok: false, error: 'Run button not found' };
      if (runBtn.disabled) return { ok: false, error: 'Run button is disabled' };

      runBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      runBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      runBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return { ok: true };
    })()`);
    if (!runResult?.ok) {
      throw new CommandExecutionError(`Could not start synthesis: ${runResult?.error || 'Run not clickable'}`);
    }

    // 6. Poll until generation completes — with fail-fast error detection
    await new Promise((r) => setTimeout(r, 3500));
    const startTime = Date.now();
    let generationComplete = false;

    while (Date.now() - startTime < maxTimeoutSec * 1000) {
      const checkStatus = await page.evaluate(`(() => {
        /* opencli:poll-generation */
        const nodes = document.querySelectorAll(
          '[role="alert"], .mat-snack-bar-container, snackbar-container, [aria-live="assertive"], .error-message, .error-container'
        );
        let errorText = '';
        nodes.forEach((n) => { errorText += '\\n' + (n.innerText || n.textContent || ''); });

        const isGenerating = Boolean(
          document.querySelector('mat-spinner') ||
          document.querySelector('button[aria-label*="Stop"]') ||
          document.querySelector('button.ctrl-enter-submits[disabled]')
        );

        const downloadBtn = document.querySelector('button.download-button')
          || Array.from(document.querySelectorAll('button')).find((b) => {
            const a = (b.getAttribute('aria-label') || '').toLowerCase();
            const t = (b.innerText || '').trim();
            return a.includes('download') || t === 'download';
          });

        return {
          errorText: errorText.slice(0, 2000),
          isGenerating,
          hasDownloadBtn: Boolean(downloadBtn && !downloadBtn.disabled),
        };
      })()`);

      const limitText = findErrorText(checkStatus?.errorText || '');
      // Only react to error text that is NEW since this run started —
      // identical text is the stale banner from an earlier attempt.
      if (limitText && checkStatus.errorText !== errorBaseline) {
        throw new CommandExecutionError(
          `Rate limit / quota error reported by AI Studio: "${limitText}". ` +
          'Rotate to another --profile or wait for the limit to reset.',
        );
      }

      if (!checkStatus.isGenerating && checkStatus.hasDownloadBtn) {
        generationComplete = true;
        break;
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!generationComplete) {
      throw new CommandExecutionError(
        `Timeout: audio generation did not finish within ${maxTimeoutSec}s.`,
      );
    }

    // 7. Trigger the download
    await page.evaluate(`(() => {
      /* opencli:click-download */
      const downloadBtn = document.querySelector('button.download-button')
        || Array.from(document.querySelectorAll('button')).find((b) => {
          const a = (b.getAttribute('aria-label') || '').toLowerCase();
          const t = (b.innerText || '').trim();
          return a.includes('download') || t === 'download';
        });
      if (downloadBtn) downloadBtn.click();
      return true;
    })()`);

    // 8. Capture the NEW file — only once its size has stopped growing
    let captured = null;
    let pending = null;
    const downloadPollStart = Date.now();

    while (Date.now() - downloadPollStart < 20000) {
      await new Promise((r) => setTimeout(r, 800));
      const fresh = pickNewFile(listAudioEntries(downloadsDir), snapshot);
      if (!fresh || fresh.size < MIN_AUDIO_BYTES) {
        pending = null;
        continue;
      }
      if (pending && pending.name === fresh.name && isStableCapture(pending.size, fresh.size, MIN_AUDIO_BYTES)) {
        captured = fresh;
        break;
      }
      pending = { name: fresh.name, size: fresh.size };
    }

    if (!captured) {
      throw new CommandExecutionError(
        'Render finished, but no new audio file appeared in the Downloads folder within 20s.',
      );
    }

    // 9. Copy → verify size AND format → only then remove the source download
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const partPath = outputPath + '.part';
    fs.copyFileSync(captured.path, partPath);

    const finalSize = fs.statSync(partPath).size;
    if (finalSize !== captured.size) {
      try { fs.unlinkSync(partPath); } catch { /* ignore */ }
      throw new CommandExecutionError(
        `Copy verification failed: output ${finalSize} bytes, source ${captured.size} bytes. Source download kept.`,
      );
    }

    // Format gate — this command's whole job is producing a real WAV; an MP3
    // in disguise (or any container surprise) must fail loudly, not "verify".
    const head = Buffer.alloc(12);
    const fd = fs.openSync(partPath, 'r');
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    if (head.subarray(0, 4).toString('latin1') !== 'RIFF' || head.subarray(8, 12).toString('latin1') !== 'WAVE') {
      try { fs.unlinkSync(partPath); } catch { /* ignore */ }
      throw new CommandExecutionError(
        `Captured file is not a valid WAV (magic bytes: ${head.subarray(0, 4).toString('hex')}). ` +
        'Refusing to pass it off as verified output. Source download kept.',
      );
    }

    fs.renameSync(partPath, outputPath);
    try { fs.unlinkSync(captured.path); } catch { /* ignore */ }

    const sizeKB = (finalSize / 1024).toFixed(1) + ' KB';
    return [{
      Model: 'Gemini 3.8 Flash TTS',
      Voice: activeVoice,
      Text: speechText,
      Output: outputPath,
      Size: sizeKB,
      Status: 'Generated & verified 🎙️',
    }];
  },
});
