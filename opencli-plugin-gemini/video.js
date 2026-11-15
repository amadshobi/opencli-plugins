import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import {
  findErrorText,
  isStableCapture,
  MIN_VIDEO_BYTES,
  pickNewFile,
} from './lib.js';

const GEMINI_APP_URL = 'https://gemini.google.com/app';

/** List downloaded Gemini video artifacts in the Downloads folder. */
function listVideoEntries(downloadsDir) {
  try {
    return fs
      .readdirSync(downloadsDir)
      .filter((name) => name.startsWith('gemini_generated_video_') && name.endsWith('.mp4'))
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

export const videoCommand = cli({
  site: 'gemini',
  name: 'video',
  access: 'write',
  description: 'Generate videos with Gemini web and save them locally (fail-fast on limits)',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  navigateBefore: false,
  defaultFormat: 'plain',
  args: [
    { name: 'prompt', positional: true, required: true, help: 'Video prompt to send to Gemini' },
    { name: 'output', default: './output.mp4', help: 'Output MP4 file path' },
    { name: 'timeout', type: 'int', default: 900, help: 'Max seconds to wait for video generation (default: 900)' },
    { name: 'downloadWait', type: 'int', default: 120, help: 'Max seconds to wait for the file to finish downloading (default: 120)' },
    { name: 'new', type: 'boolean', default: false, help: 'Start a new chat first (default: false)' },
  ],
  columns: ['Status', 'Output', 'Size'],
  func: async (page, kwargs) => {
    const prompt = String(kwargs.prompt || '').trim();
    const outputPath = path.resolve(String(kwargs.output || './output.mp4'));
    const timeout = Number(kwargs.timeout || 900);
    const downloadWaitMs = Number(kwargs.downloadWait || 120) * 1000;
    const downloadsDir = path.join(os.homedir(), 'Downloads');

    // 1. Make sure we are on the Gemini app
    const onGemini = await page.evaluate(`(() => {
      /* opencli:check-page */
      return location.hostname === 'gemini.google.com';
    })()`);
    if (!onGemini) {
      await page.goto(GEMINI_APP_URL, { waitUntil: 'load', settleMs: 2500 });
    }

    // 2. Optional fresh chat
    if (kwargs.new) {
      await page.goto(GEMINI_APP_URL, { waitUntil: 'load', settleMs: 2500 });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 3. Mark existing download buttons + snapshot Downloads BEFORE sending.
    // Only a button appended by THIS generation is clickable afterwards.
    await page.evaluate(`(() => {
      /* opencli:mark-buttons */
      document.querySelectorAll('button[aria-label*="Download video"], [aria-label*="download video"]')
        .forEach((b) => b.setAttribute('data-opencli-seen', '1'));
      return true;
    })()`);
    const snapshot = new Set(listVideoEntries(downloadsDir).map((entry) => entry.name));

    // 3b. Baseline the error containers — stale banners from earlier turns
    // must never abort this render
    const errorBaseline = await page.evaluate(`(() => {
      /* opencli:error-baseline */
      const nodes = document.querySelectorAll(
        '[role="alert"], .error-message, .error-container, [aria-live="polite"] .error, [data-test-id*="error"]'
      );
      let text = '';
      nodes.forEach((n) => { text += '\\n' + (n.innerText || n.textContent || ''); });
      return text.slice(0, 2000);
    })()`);

    // 4. Compose and send the prompt
    const fullPrompt = prompt.toLowerCase().includes('video') ? prompt : `Generate video: ${prompt}`;
    const sendResult = await page.evaluate(`(async () => {
      /* opencli:fill-prompt */
      const PROMPT = ${JSON.stringify(fullPrompt)};
      const box = document.querySelector('rich-textarea textarea')
        || document.querySelector('rich-textarea div[contenteditable="true"]')
        || document.querySelector('div[contenteditable="true"]')
        || document.querySelector('textarea');
      if (!box) return { ok: false, error: 'Gemini composer not found' };
      box.focus();
      await new Promise((r) => setTimeout(r, 300));

      if (box.isContentEditable) {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, PROMPT);
      } else {
        box.value = PROMPT;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise((r) => setTimeout(r, 600));

      const current = (box.innerText || box.value || '').trim();
      if (!current.includes(PROMPT.slice(0, 24))) {
        return { ok: false, error: 'Failed to insert prompt text' };
      }

      const submitBtn = Array.from(document.querySelectorAll('button')).find((b) => {
        const label = (b.getAttribute('aria-label') || '').toLowerCase();
        const testId = (b.getAttribute('test-id') || '').toLowerCase();
        return label.includes('send') || label.includes('submit') || testId.includes('send');
      });
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
        return { ok: true, via: 'button' };
      }
      if (typeof window.__opencliEnter === 'function') {
        window.__opencliEnter();
      }
      const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
      box.dispatchEvent(enter);
      return { ok: true, via: 'enter' };
    })()`);
    if (!sendResult?.ok) {
      throw new CommandExecutionError(`Could not send prompt: ${sendResult?.error || 'composer not usable'}`);
    }

    const triggerTime = Date.now();

    // 5. Poll for the download button — fail fast on limits
    const startTime = Date.now();
    let downloadTriggered = false;

    while (Date.now() - startTime < timeout * 1000) {
      await new Promise((r) => setTimeout(r, 4000));
      const state = await page.evaluate(`(() => {
        /* opencli:poll */
        const nodes = document.querySelectorAll(
          '[role="alert"], .error-message, .error-container, [aria-live="polite"] .error, [data-test-id*="error"]'
        );
        let errorText = '';
        nodes.forEach((n) => { errorText += '\\n' + (n.innerText || n.textContent || ''); });

        const btns = Array.from(document.querySelectorAll(
          'button[aria-label*="Download video"]:not([data-opencli-seen]), [aria-label*="download video"]:not([data-opencli-seen])'
        ));
        if (btns.length > 0) {
          btns[btns.length - 1].click();
          return { errorText: errorText.slice(0, 2000), clicked: true };
        }
        return { errorText: errorText.slice(0, 2000), clicked: false };
      })()`);

      // Success signal first: a clickable fresh download button outranks any
      // error banner text.
      if (state?.clicked) {
        downloadTriggered = true;
        break;
      }

      const limitText = findErrorText(state?.errorText || '');
      // Only react to error text that is NEW since this run started —
      // identical text is the stale banner from an earlier attempt.
      const freshError = limitText && state.errorText !== errorBaseline;
      if (freshError) {
        throw new CommandExecutionError(
          `Rate limit / generation error reported by Gemini: "${limitText}". ` +
          'Rotate to another --profile or wait for the bucket to reset.',
        );
      }
    }

    if (!downloadTriggered) {
      throw new CommandExecutionError(
        `Timeout: no download button appeared within ${timeout}s ` +
        '(or the generation was refused without an error banner).',
      );
    }

    // 6. Wait for the NEW file to land and stabilise
    let captured = null;
    let pending = null;
    const downloadPollStart = Date.now();

    while (Date.now() - downloadPollStart < downloadWaitMs) {
      await new Promise((r) => setTimeout(r, 1000));
      const fresh = pickNewFile(listVideoEntries(downloadsDir), snapshot);
      if (!fresh || fresh.size < MIN_VIDEO_BYTES || fresh.mtimeMs < triggerTime - 5000) {
        pending = null;
        continue;
      }
      if (pending && pending.name === fresh.name && isStableCapture(pending.size, fresh.size, MIN_VIDEO_BYTES)) {
        captured = fresh;
        break;
      }
      pending = { name: fresh.name, size: fresh.size };
    }

    if (!captured) {
      throw new CommandExecutionError(
        'Download button was clicked, but no new video file landed in the Downloads folder. ' +
        'Check the browser for a "Keep" confirmation prompt.',
      );
    }

    // 7. Copy → verify → only then remove the source download
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

    fs.renameSync(partPath, outputPath);
    try { fs.unlinkSync(captured.path); } catch { /* ignore */ }

    return [{
      Status: '✅ Rendered (verified)',
      Output: outputPath,
      Size: `${(finalSize / (1024 * 1024)).toFixed(2)} MB`,
    }];
  },
});
