import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
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
  ],
  func: async (page, kwargs) => {
    const speechText = String(kwargs.text || 'Halo BOSS, ini suara resmi Gemini 3.8 Flash TTS langsung dari terminal!');
    const requestedVoice = kwargs.voice ? String(kwargs.voice).trim() : null;
    const outputPath = path.resolve(String(kwargs.output || './speech.wav'));
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const maxTimeoutSec = 90;
    const commandStartTime = Date.now() - 2000;

    // 1. Ensure we are in Dialog editor
    const setupResult = await page.evaluate(`(async () => {
      let ta = document.querySelector('textarea[aria-label="Speech block text"]') || document.querySelector('textarea');
      if (ta) return { ok: true, ready: true };

      const card = document.querySelector('mat-card.create-dialog-card')
                   || Array.from(document.querySelectorAll('mat-card, [role="button"], button')).find(el => (el.innerText || '').includes('Create new dialog'));
      if (card) {
        card.click();
        await new Promise(r => setTimeout(r, 1200));
      }

      for (let i = 0; i < 15; i++) {
        ta = document.querySelector('textarea[aria-label="Speech block text"]') || document.querySelector('textarea');
        if (ta && !ta.disabled) return { ok: true, ready: true };
        await new Promise(r => setTimeout(r, 400));
      }

      return { ok: false, error: 'Could not open speech dialog editor' };
    })()`);

    if (!setupResult?.ok) {
      return [{
        Model: 'Gemini 3.8 Flash TTS',
        Voice: requestedVoice || 'Fola',
        Text: speechText,
        Output: outputPath,
        Size: '-',
        Status: 'Failed: ' + (setupResult?.error || 'Editor setup failed'),
      }];
    }

    // 2. Select voice persona if requested
    if (requestedVoice) {
      await page.evaluate(`(async () => {
        const speakerBtn = Array.from(document.querySelectorAll('button')).find(el => (el.innerText || '').includes('Speaker 1'));
        if (speakerBtn && !(speakerBtn.innerText || '').toLowerCase().includes(${JSON.stringify(requestedVoice.toLowerCase())})) {
          speakerBtn.click();
          await new Promise(r => setTimeout(r, 800));

          const overlay = document.querySelector('.cdk-overlay-container');
          if (overlay) {
            const input = overlay.querySelector('input');
            if (input) {
              input.value = ${JSON.stringify(requestedVoice)};
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise(r => setTimeout(r, 900));

              const targetVoice = Array.from(overlay.querySelectorAll('*')).find(el => 
                el.childElementCount === 0 && (el.innerText || '').trim().toLowerCase() === ${JSON.stringify(requestedVoice.toLowerCase())}
              );
              if (targetVoice) {
                const clickable = targetVoice.closest('button, [role="button"], div[tabindex]') || targetVoice;
                clickable.click();
                await new Promise(r => setTimeout(r, 600));
              }
            }

            const closeBtn = Array.from(overlay.querySelectorAll('button')).find(b => (b.innerText || '').includes('close'));
            if (closeBtn) closeBtn.click();
            await new Promise(r => setTimeout(r, 600));
          }
        }
      })()`);
    }

    // Read active selected voice name
    const activeVoice = await page.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(el => (el.innerText || '').includes('Speaker 1'));
      return btn ? btn.innerText.replace('arrow_drop_down', '').replace('Speaker 1 -', '').trim() : 'Fola';
    })()`);

    // 3. Set speech text & trigger Run via full mouse event sequence
    const runResult = await page.evaluate(`(async () => {
      const ta = document.querySelector('textarea[aria-label="Speech block text"]') || document.querySelector('textarea');
      if (!ta) return { ok: false, error: 'Speech textarea not found' };

      ta.value = ${JSON.stringify(speechText)};
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(r => setTimeout(r, 600));

      const runBtn = document.querySelector('button.ctrl-enter-submits')
                     || Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').startsWith('Run'));
      if (!runBtn) return { ok: false, error: 'Run button not found' };
      if (runBtn.disabled) return { ok: false, error: 'Run button is disabled' };

      // Dispatch full mouse event chain for Angular/Material
      runBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      runBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      runBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      return { ok: true };
    })()`);

    if (!runResult?.ok) {
      return [{
        Model: 'Gemini 3.8 Flash TTS',
        Voice: activeVoice,
        Text: speechText,
        Output: outputPath,
        Size: '-',
        Status: 'Failed: ' + (runResult?.error || 'Could not click Run'),
      }];
    }

    // 4. Poll until speech generation completes (download button becomes available & spinner clears)
    const startTime = Date.now();
    let generationComplete = false;

    // Small delay for generation to initialize
    await new Promise(r => setTimeout(r, 3500));

    while ((Date.now() - startTime) < maxTimeoutSec * 1000) {
      const checkStatus = await page.evaluate(`(() => {
        const isGenerating = Boolean(
          document.querySelector('mat-spinner') ||
          document.querySelector('button[aria-label*="Stop"]') ||
          document.querySelector('button.ctrl-enter-submits[disabled]')
        );

        const downloadBtn = document.querySelector('button.download-button')
                            || Array.from(document.querySelectorAll('button')).find(b => {
                                 const a = (b.getAttribute('aria-label') || '').toLowerCase();
                                 const t = (b.innerText || '').trim();
                                 return a.includes('download') || t === 'download';
                               });

        return {
          isGenerating,
          hasDownloadBtn: Boolean(downloadBtn && !downloadBtn.disabled)
        };
      })()`);

      if (!checkStatus.isGenerating && checkStatus.hasDownloadBtn) {
        generationComplete = true;
        break;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    if (!generationComplete) {
      return [{
        Model: 'Gemini 3.8 Flash TTS',
        Voice: activeVoice,
        Text: speechText,
        Output: outputPath,
        Size: '-',
        Status: 'Timeout: Audio generation took longer than ' + maxTimeoutSec + 's.',
      }];
    }

    // 5. Trigger download button from DOM
    await page.evaluate(`(() => {
      const downloadBtn = document.querySelector('button.download-button')
                          || Array.from(document.querySelectorAll('button')).find(b => {
                               const a = (b.getAttribute('aria-label') || '').toLowerCase();
                               const t = (b.innerText || '').trim();
                               return a.includes('download') || t === 'download';
                             });
      if (downloadBtn) {
        downloadBtn.click();
      }
    })()`);

    // 6. Capture the generated audio file from disk (handles .wav and .crdownload automatically)
    let capturedFile = null;
    const downloadPollStart = Date.now();

    while ((Date.now() - downloadPollStart) < 15000) {
      try {
        const files = fs.readdirSync(downloadsDir);
        const candidates = files
          .filter(f => f.startsWith('Generated Audio') && (f.endsWith('.wav') || f.includes('.wav.crdownload')))
          .map(f => {
            const fullPath = path.join(downloadsDir, f);
            try {
              const stat = fs.statSync(fullPath);
              return { file: f, path: fullPath, mtime: stat.mtimeMs, size: stat.size };
            } catch {
              return null;
            }
          })
          .filter(c => c && c.mtime >= commandStartTime && c.size > 10000)
          .sort((a, b) => b.mtime - a.mtime);

        if (candidates.length > 0) {
          capturedFile = candidates[0];
          break;
        }
      } catch (err) {
        // Retry
      }
      await new Promise(r => setTimeout(r, 800));
    }

    if (!capturedFile) {
      // Fallback: check if any recent .crdownload exists
      return [{
        Model: 'Gemini 3.8 Flash TTS',
        Voice: activeVoice,
        Text: speechText,
        Output: outputPath,
        Size: '-',
        Status: 'Render finished, but download file was not detected in Downloads folder.',
      }];
    }

    // 7. Copy captured audio file directly to target outputPath
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(capturedFile.path, outputPath);

    // Clean up temporary download file from Downloads
    try {
      fs.unlinkSync(capturedFile.path);
    } catch {
      // Ignore cleanup error
    }

    const finalStat = fs.statSync(outputPath);
    const sizeKB = (finalStat.size / 1024).toFixed(1) + ' KB';

    return [{
      Model: 'Gemini 3.8 Flash TTS',
      Voice: activeVoice,
      Text: speechText,
      Output: outputPath,
      Size: sizeKB,
      Status: 'Generated & Auto-Saved Successfully! 🎙️🎉',
    }];
  },
});
