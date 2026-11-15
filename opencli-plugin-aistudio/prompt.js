import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'aistudio',
  name: 'prompt',
  description: 'Send prompt directly to Google AI Studio Web Playground without API key',
  access: 'write',
  domain: 'aistudio.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  navigateBefore: 'https://aistudio.google.com/prompts/new_chat',
  columns: ['Model', 'Prompt', 'Output', 'Status'],
  args: [
    {
      name: 'prompt',
      positional: true,
      required: true,
      help: 'Prompt text to send or execute in AI Studio',
    },
    {
      name: 'run',
      positional: false,
      type: 'boolean',
      default: true,
      help: 'Automatically click Run button (default: true)',
    },
  ],
  func: async (page, kwargs) => {
    const promptText = String(kwargs.prompt || '');
    const autoRun = kwargs.run !== false;

    // Execute in the active tab context via Browser Bridge
    const result = await page.evaluate(`(async () => {
      // 1. Find the prompt textarea
      const ta = document.querySelector('textarea[aria-label="Enter a prompt"]') 
                 || document.querySelector('textarea[placeholder*="prompt"]')
                 || document.querySelector('textarea');
      if (!ta) return { ok: false, error: 'Textarea prompt tidak ditemukan di tab AI Studio' };

      // 2. Set value & trigger native input events for Angular/React
      ta.value = ${JSON.stringify(promptText)};
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      let ran = false;
      if (${autoRun}) {
        await new Promise(r => setTimeout(r, 600));
        // 3. Find Run button
        const runBtn = document.querySelector('button.ctrl-enter-submits')
                       || Array.from(document.querySelectorAll('button')).find(b => {
                            const t = (b.textContent || '').trim();
                            return t.startsWith('Run') || b.getAttribute('aria-label') === 'Run Ctrl Enter';
                          });
        if (runBtn && !runBtn.disabled) {
          runBtn.click();
          ran = true;
        }
      }

      // Check current model name
      const modelElem = document.querySelector('ms-model-selector button') 
                        || Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Gemini') || b.textContent.includes('Hydrogen')));
      const activeModel = modelElem ? modelElem.textContent.trim().split('\\n')[0] : 'AI Studio Playground';

      return { ok: true, model: activeModel, ran };
    })()`);

    if (result && !result.ok) {
      return [
        {
          Model: 'Unknown',
          Prompt: promptText,
          Output: result.error,
          Status: 'Failed',
        },
      ];
    }

    return [
      {
        Model: result?.model || 'Gemini (AI Studio Web)',
        Prompt: promptText,
        Output: result?.ran ? 'Prompt berhasil dimasukkan & tombol Run langsung diklik!' : 'Prompt berhasil dimasukkan ke box playground!',
        Status: 'Success (Web Playground)',
      },
    ];
  },
});
