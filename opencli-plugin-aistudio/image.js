import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'aistudio',
  name: 'image',
  description: 'Generate images using Nano Banana 2.1 in Google AI Studio Web without API key',
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
      help: 'Text description of the image to generate',
    },
    {
      name: 'model',
      positional: false,
      required: false,
      help: 'Image model (default: gemini-nano-banana-2.1)',
    },
    {
      name: 'output',
      positional: false,
      required: false,
      help: 'Target path to save generated image (default: ./output.png)',
    },
  ],
  func: async (page, kwargs) => {
    const promptText = String(kwargs.prompt || '');
    const targetModel = String(kwargs.model || 'gemini-nano-banana-2.1');
    const outputPath = path.resolve(String(kwargs.output || './output.png'));
    const maxTimeoutSec = 90;

    // 1. Ensure target model (Nano Banana 2.1) is selected
    await page.evaluate(`(async () => {
      const modelElem = document.querySelector('ms-model-selector button');
      const current = modelElem ? modelElem.innerText : '';
      if (current.toLowerCase().includes('banana') || current.includes('2.1')) return { ok: true };

      if (modelElem) modelElem.click();
      await new Promise(r => setTimeout(r, 800));

      const imagesTab = Array.from(document.querySelectorAll('mat-chip-row, [role="tab"], button'))
        .find(el => el.innerText.trim() === 'Images');
      if (imagesTab) imagesTab.click();
      await new Promise(r => setTimeout(r, 800));

      const cards = Array.from(document.querySelectorAll('mat-dialog-container button, [role="dialog"] button, [role="dialog"] div[tabindex]'));
      const bananaCard = cards.find(c => (c.innerText || '').toLowerCase().includes('nano banana 2.1') || (c.innerText || '').includes('gemini-nano-banana-2.1'));
      if (bananaCard) {
        bananaCard.click();
        await new Promise(r => setTimeout(r, 1000));
        return { ok: true };
      }

      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'close' || b.getAttribute('aria-label') === 'Close');
      if (closeBtn) closeBtn.click();
      return { ok: false, error: 'Image model card not found' };
    })()`);

    // 2. Wait for textarea, set text and submit
    const inputResult = await page.evaluate(`(async () => {
      let ta = null;
      for (let i = 0; i < 15; i++) {
        ta = document.querySelector('textarea[aria-label="Enter a prompt"]') 
             || document.querySelector('textarea[placeholder*="prompt"]')
             || document.querySelector('textarea');
        if (ta && !ta.disabled) break;
        await new Promise(r => setTimeout(r, 400));
      }
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
        Model: 'Nano Banana 2.1',
        Prompt: promptText,
        Output: outputPath,
        Size: '-',
        Status: 'Failed: ' + (inputResult?.error || 'Could not trigger Run'),
      }];
    }

    // 3. Poll for generated image
    const startTime = Date.now();
    let imgData = null;

    await new Promise(r => setTimeout(r, 3000));

    while ((Date.now() - startTime) < maxTimeoutSec * 1000) {
      const pollResult = await page.evaluate(`(async () => {
        const isGenerating = Boolean(
          document.querySelector('button[aria-label*="Stop"]') ||
          document.querySelector('mat-spinner') ||
          document.querySelector('button.ctrl-enter-submits[disabled]')
        );

        const imgs = Array.from(document.querySelectorAll('ms-chat-turn img, .model-response img, [data-test-id*="image"] img'));
        const targetImg = imgs.find(img => img.src && (img.src.startsWith('blob:') || img.src.startsWith('data:') || img.src.includes('googleusercontent')));

        if (targetImg && (!isGenerating || document.querySelector('button[aria-label*="Download"]'))) {
          try {
            const resp = await fetch(targetImg.src);
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
        imgData = pollResult;
        break;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    if (!imgData) {
      return [{
        Model: 'Nano Banana 2.1',
        Prompt: promptText,
        Output: outputPath,
        Size: '-',
        Status: 'Timeout: Image generation took longer than ' + maxTimeoutSec + 's.',
      }];
    }

    // 4. Save image buffer to outputPath
    const base64Clean = imgData.base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    const sizeKB = (buffer.length / 1024).toFixed(1) + ' KB';

    return [{
      Model: 'Nano Banana 2.1',
      Prompt: promptText,
      Output: outputPath,
      Size: sizeKB,
      Status: 'Generated & Auto-Saved Successfully! 🎨',
    }];
  },
});
