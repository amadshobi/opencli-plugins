import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import {
  findErrorText,
  MIN_VIDEO_BYTES,
  MIN_VIDEO_DURATION_S,
  VIDEO_CHUNK_SIZE,
} from './lib.js';

/**
 * Mark every <video> currently on the page as seen. After this, only
 * elements appended by the new generation are pickable, so a persistent
 * chat can never make us grab a previous clip.
 */
const MARK_VIDEOS_SCRIPT = `(() => {
  /* opencli:mark-videos */
  document.querySelectorAll('video').forEach((v) => v.setAttribute('data-opencli-seen', '1'));
  return true;
})()`;

/** Un-mark the most recently seen video (extraction failed → allow retry). */
const UNMARK_NEWEST_SCRIPT = `(() => {
  /* opencli:unmark-newest */
  const seen = document.querySelectorAll('video[data-opencli-seen]');
  const target = seen.length ? seen[seen.length - 1] : null;
  if (target) target.removeAttribute('data-opencli-seen');
  return true;
})()`;

/** Drop the stashed byte array from page memory. */
const CLEANUP_BYTES_SCRIPT = `(() => {
  /* opencli:cleanup-bytes */
  delete window.__opencliVideoBytes;
  return true;
})()`;

export const videoCommand = cli({
  site: 'aistudio',
  name: 'video',
  description: 'Generate video clips using Gemini Omni 1.2 Flash in Google AI Studio Web without API key',
  access: 'write',
  domain: 'aistudio.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  navigateBefore: 'https://aistudio.google.com/prompts/new_chat',
  columns: ['Model', 'Prompt', 'Output', 'Size', 'Status'],
  args: [
    {
      name: 'prompt',
      positional: true,
      required: true,
      help: 'Text prompt describing the video scene and motion',
    },
    {
      name: 'model',
      positional: false,
      required: false,
      help: 'Target video model (default: gemini-omni-1.2-flash)',
    },
    {
      name: 'output',
      positional: false,
      required: false,
      help: 'Output file path (default: ./output.mp4)',
    },
    {
      name: 'timeout',
      type: 'int',
      default: 900,
      help: 'Max seconds to wait for the render (default: 900)',
    },
  ],
  func: async (page, kwargs) => {
    const promptText = String(kwargs.prompt || '');
    const targetModel = String(kwargs.model || 'gemini-omni-1.2-flash');
    const outputPath = path.resolve(String(kwargs.output || './output.mp4'));
    const maxTimeoutSec = Number(kwargs.timeout || 900);

    // 1. Ensure the target video model is selected
    const modelResult = await page.evaluate(`(async () => {
      /* opencli:model-setup */
      const modelElem = document.querySelector('ms-model-selector button');
      const current = modelElem ? modelElem.innerText : '';
      if (current.toLowerCase().includes('omni')) return { ok: true, switched: false };

      if (modelElem) modelElem.click();
      await new Promise((r) => setTimeout(r, 800));

      const videoTab = Array.from(document.querySelectorAll('mat-chip-row, [role="tab"], button'))
        .find((el) => el.innerText.trim() === 'Video');
      if (videoTab) videoTab.click();
      await new Promise((r) => setTimeout(r, 600));

      const cards = Array.from(document.querySelectorAll('mat-dialog-container button, [role="dialog"] button, [role="dialog"] div[tabindex]'));
      const omniCard = cards.find((c) => (c.innerText || '').toLowerCase().includes('gemini omni 1.2 flash') || (c.innerText || '').includes('gemini-omni-1.2-flash'));
      if (omniCard) {
        omniCard.click();
        await new Promise((r) => setTimeout(r, 600));
        return { ok: true, switched: true };
      }

      const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText === 'close' || b.getAttribute('aria-label') === 'Close');
      if (closeBtn) closeBtn.click();
      return { ok: false, error: 'Model card not found' };
    })()`);
    if (!modelResult?.ok) {
      throw new CommandExecutionError(
        `Model setup failed: ${modelResult?.error || `could not select ${targetModel}`}`,
      );
    }

    // 2. Snapshot existing videos BEFORE submitting (only fresh ones count)
    await page.evaluate(MARK_VIDEOS_SCRIPT);

    // 2b. Baseline the error containers — stale banners from earlier runs on
    // this persistent tab must never abort the current render
    const errorBaseline = await page.evaluate(`(() => {
      /* opencli:error-baseline */
      const nodes = document.querySelectorAll(
        '[role="alert"], .mat-snack-bar-container, snackbar-container, [aria-live="assertive"], .error-message, .error-container'
      );
      let text = '';
      nodes.forEach((n) => { text += '\\n' + (n.innerText || n.textContent || ''); });
      return text.slice(0, 2000);
    })()`);

    // 3. Fill prompt and trigger Run
    const inputResult = await page.evaluate(`(async () => {
      /* opencli:fill-prompt */
      const ta = document.querySelector('textarea[aria-label="Enter a prompt"]')
        || document.querySelector('textarea[placeholder*="prompt"]')
        || document.querySelector('textarea');
      if (!ta) return { ok: false, error: 'Prompt textarea not found' };

      ta.value = ${JSON.stringify(promptText)};
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 600));

      const runBtn = document.querySelector('button.ctrl-enter-submits')
        || Array.from(document.querySelectorAll('button')).find((b) => {
          const t = (b.textContent || '').trim();
          return t.startsWith('Run') || b.getAttribute('aria-label') === 'Run Ctrl Enter';
        });
      if (!runBtn) return { ok: false, error: 'Run button not found' };
      if (runBtn.disabled) return { ok: false, error: 'Run button is disabled' };

      runBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      runBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      runBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return { ok: true };
    })()`);
    if (!inputResult?.ok) {
      throw new CommandExecutionError(
        `Could not start generation: ${inputResult?.error || 'Run button not usable'}`,
      );
    }

    // 4. Poll for completion with fail-fast error detection
    const startTime = Date.now();
    await new Promise((r) => setTimeout(r, 8000));

    while (Date.now() - startTime < maxTimeoutSec * 1000) {
      const state = await page.evaluate(`(async () => {
        /* opencli:poll */
        const nodes = document.querySelectorAll(
          '[role="alert"], .mat-snack-bar-container, snackbar-container, [aria-live="assertive"], .error-message, .error-container'
        );
        let errorText = '';
        nodes.forEach((n) => { errorText += '\\n' + (n.innerText || n.textContent || ''); });

        const isGenerating = Boolean(
          document.querySelector('button[aria-label*="Stop"]') ||
          document.querySelector('mat-spinner') ||
          document.querySelector('button.ctrl-enter-submits[disabled]')
        );

        // Prefer candidates inside chat turns; fall back to any fresh video
        const inTurns = Array.from(document.querySelectorAll('ms-chat-turn video:not([data-opencli-seen])'));
        const fresh = inTurns.length
          ? inTurns
          : Array.from(document.querySelectorAll('video:not([data-opencli-seen])'));
        const video = fresh.length ? fresh[fresh.length - 1] : null;
        const videoInfo = video && video.src
          ? {
              found: true,
              duration: Number(video.duration || 0),
              width: Number(video.videoWidth || 0),
              height: Number(video.videoHeight || 0),
              readyState: Number(video.readyState || 0),
            }
          : { found: false };

        return { errorText: errorText.slice(0, 2000), isGenerating, video: videoInfo };
      })()`);

      // Success signal first: a finished video outranks any error banner
      const candidate = state?.video;
      const limitText = findErrorText(state?.errorText || '');
      // Only react to error text that is NEW since this run started —
      // identical text is the stale banner from an earlier attempt.
      const freshError = limitText && state.errorText !== errorBaseline;

      if (!candidate?.found && freshError) {
        throw new CommandExecutionError(
          `Rate limit / quota error reported by AI Studio: "${limitText}". ` +
          'Rotate to another --profile or wait for the limit to reset.',
        );
      }

      if (candidate?.found && candidate.duration >= MIN_VIDEO_DURATION_S && candidate.readyState >= 2) {
        // Claim this element so a retry can never double-grab it
        await page.evaluate(MARK_VIDEOS_SCRIPT);

        // 5. Pull the bytes into page memory
        const stash = await page.evaluate(`(async () => {
          /* opencli:stash-bytes */
          const seen = Array.from(document.querySelectorAll('video[data-opencli-seen]'));
          const video = seen.length ? seen[seen.length - 1] : null;
          if (!video || !video.src) return { ok: false, error: 'no video source' };
          try {
            const resp = await fetch(video.src);
            const buf = await resp.arrayBuffer();
            window.__opencliVideoBytes = new Uint8Array(buf);
            return {
              ok: true,
              len: window.__opencliVideoBytes.length,
              chunks: Math.ceil(window.__opencliVideoBytes.length / ${VIDEO_CHUNK_SIZE}),
            };
          } catch (e) {
            return { ok: false, error: String(e) };
          }
        })()`);

        if (!stash?.ok || (stash.len || 0) < MIN_VIDEO_BYTES) {
          // Preview/partial or fetch hiccup → release the element and keep polling
          await page.evaluate(CLEANUP_BYTES_SCRIPT);
          await page.evaluate(UNMARK_NEWEST_SCRIPT);
        } else {
          // 6. Chunked write to a .part file + strict verification, then promote.
          // A pre-existing good file at outputPath is never destroyed on failure.
          const partPath = outputPath + '.part';
          fs.writeFileSync(partPath, Buffer.alloc(0));
          try {
            for (let i = 0; i < stash.chunks; i += 1) {
              const start = i * VIDEO_CHUNK_SIZE;
              const end = (i + 1) * VIDEO_CHUNK_SIZE;
              const chunkB64 = await page.evaluate(`(() => {
                /* opencli:read-chunk */
                const c = window.__opencliVideoBytes.slice(${start}, ${end});
                let s = '';
                for (let j = 0; j < c.length; j += 1) s += String.fromCharCode(c[j]);
                return btoa(s);
              })()`);
              fs.appendFileSync(partPath, Buffer.from(chunkB64, 'base64'));
            }

            const written = fs.statSync(partPath).size;
            if (written !== stash.len) {
              throw new Error(`Incomplete extraction: wrote ${written} of ${stash.len} bytes`);
            }

            fs.renameSync(partPath, outputPath);
            await page.evaluate(CLEANUP_BYTES_SCRIPT);
            const sizeMB = (written / (1024 * 1024)).toFixed(2) + ' MB';
            return [{
              Model: targetModel,
              Prompt: promptText,
              Output: outputPath,
              Size: sizeMB,
              Status: 'Generated & extracted (verified) 🎬',
            }];
          } catch (err) {
            // Never leave a corrupt partial file behind
            try { fs.unlinkSync(partPath); } catch { /* ignore */ }
            await page.evaluate(CLEANUP_BYTES_SCRIPT);
            await page.evaluate(UNMARK_NEWEST_SCRIPT);
            if (err instanceof CommandExecutionError) throw err;
            // Transient extraction failure → keep polling until the timeout
          }
        }
      }

      await new Promise((r) => setTimeout(r, 4000));
    }

    await page.evaluate(CLEANUP_BYTES_SCRIPT);
    throw new CommandExecutionError(
      `Timeout: AI Studio did not finish the video within ${maxTimeoutSec}s. ` +
      'If the account just hit its generation bucket, rotate --profile and retry.',
    );
  },
});