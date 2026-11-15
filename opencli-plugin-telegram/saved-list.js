import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'saved-list',
  description: 'List recently saved messages, code snippets, and notes in Saved Messages',
  access: 'read',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  columns: ['Index', 'Time', 'ContentPreview', 'Length'],
  args: [
    {
      name: 'limit',
      positional: false,
      required: false,
      default: 10,
      help: 'Number of saved items to fetch (default: 10)',
    },
  ],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit || 10);

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      // Open Saved Messages
      const openRes = await openChat('Saved Messages');
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1200);

      const msgs = Array.from(document.querySelectorAll('#MiddleColumn .Message')).slice(-${limit});
      const data = msgs.map((m, i) => {
        const timeEl = m.querySelector('.message-time, .time');
        const textEl = m.querySelector('.message-content, .text-content');
        const content = (textEl ? textEl.innerText.trim() : m.innerText.trim()).replace(/\\n+/g, ' ');
        const time = timeEl ? timeEl.innerText.trim() : '';

        return {
          Index: i + 1,
          Time: time,
          ContentPreview: content.length > 80 ? content.slice(0, 77) + '...' : content,
          Length: content.length + ' chars',
        };
      });

      return { ok: true, data };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal membaca Saved Messages.');
    }

    return res.data;
  },
});
