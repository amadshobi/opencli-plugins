import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
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
  ],
  func: async (page, kwargs) => {
    const promptText = String(kwargs.prompt || '');
    const targetModel = String(kwargs.model || 'gemini-omni-1.2-flash');
    const outputPath = path.resolve(String(kwargs.output || './output.mp4'));
    const maxTimeoutSec = Number(kwargs.timeout || 180);

    // 1. Ensure target model (Gemini Omni 1.2 Flash) is selected in AI Studio
    await page.evaluate(`(async () => {
      const modelElem = document.querySelector('ms-model-selector button');
      const current = modelElem ? modelElem.innerText : '';
      if (current.toLowerCase().includes('omni')) return { ok: true, switched: false };

      if (modelElem) modelElem.click();
      await new Promise(r => setTimeout(r, 800));

      const videoTab = Array.from(document.querySelectorAll('mat-chip-row, [role="tab"], button'))
        .find(el => el.innerText.trim() === 'Video');
      if (videoTab) videoTab.click();
      await new Promise(r => setTimeout(r, 600));

      const cards = Array.from(document.querySelectorAll('mat-dialog-container button, [role="dialog"] button, [role="dialog"] div[tabindex]'));
      const omniCard = cards.find(c => (c.innerText || '').toLowerCase().includes('gemini omni 1.2 flash') || (c.innerText || '').includes('gemini-omni-1.2-flash'));
      if (omniCard) {
        omniCard.click();
        await new Promise(r => setTimeout(r, 600));
        return { ok: true, switched: true };
      }

      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'close' || b.getAttribute('aria-label') === 'Close');
      if (closeBtn) closeBtn.click();
      return { ok: false, error: 'Model card not found' };
    })()`);

    // 2. Clear & enter prompt in textarea and submit
    const inputResult = await page.evaluate(`(async () => {
      const ta = document.querySelector('textarea[aria-label="Enter a prompt"]') 
                 || document.querySelector('textarea[placeholder*="prompt"]')
                 || document.querySelector('textarea');
      if (!ta) return { ok: false, error: 'Prompt textarea not found' };

      ta.value = ${JSON.stringify(promptText)};
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(r => setTimeout(r, 600));

      const runBtn = document.querySelector('button.ctrl-enter-submits')
                     || Array.from(document.querySelectorAll('button')).find(b => {
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
      return [{
        Model: targetModel,
        Prompt: promptText,
        Output: outputPath,
        Size: '-',
        Status: 'Failed: ' + (inputResult?.error || 'Could not trigger Run'),
      }];
    }

    // 3. Poll for completion & video blob
    const startTime = Date.now();
    let videoData = null;

    // Give browser 5s to spin up video generation
    await new Promise(r => setTimeout(r, 5000));

    while ((Date.now() - startTime) < maxTimeoutSec * 1000) {
      const pollResult = await page.evaluate(`(async () => {
        const isGenerating = Boolean(
          document.querySelector('button[aria-label*="Stop"]') ||
          document.querySelector('mat-spinner') ||
          document.querySelector('button.ctrl-enter-submits[disabled]')
        );

        const video = document.querySelector('video');
        const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => 
          (b.getAttribute('aria-label') || b.innerText || '').toLowerCase().includes('download video')
        );

        if (video && video.src && (!isGenerating || downloadBtn)) {
          try {
            const resp = await fetch(video.src);
            const blob = await resp.blob();
            if (blob.size > 1000) {
              return new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({ ok: true, base64: reader.result, size: blob.size });
                reader.readAsDataURL(blob);
              });
            }
          } catch (e) {
            return { ok: false, error: e.message };
          }
        }

        return { ok: false, pending: true, isGenerating };
      })()`);

      if (pollResult?.ok && pollResult.base64) {
        videoData = pollResult;
        break;
      }

      await new Promise(r => setTimeout(r, 4000));
    }

    if (!videoData) {
      return [{
        Model: targetModel,
        Prompt: promptText,
        Output: outputPath,
        Size: '-',
        Status: 'Timeout: Video rendering took longer than ' + maxTimeoutSec + 's. Check Edge tab.',
      }];
    }

    // 4. Save video blob buffer to outputPath
    const base64Prefix = 'data:video/mp4;base64,';
    const base64Clean = videoData.base64.startsWith(base64Prefix)
      ? videoData.base64.slice(base64Prefix.length)
      : videoData.base64.replace(/^data:[^;]+;base64,/, '');

    const buffer = Buffer.from(base64Clean, 'base64');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2) + ' MB';

    return [{
      Model: 'Gemini Omni 1.2 Flash',
      Prompt: promptText,
      Output: outputPath,
      Size: sizeMB,
      Status: 'Generated & Auto-Saved Successfully! 🎉',
    }];
  },
});
