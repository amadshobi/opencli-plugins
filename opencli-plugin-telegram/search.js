import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'search',
  description: 'Search for channels, groups, bots, contacts, or messages in Telegram',
  access: 'read',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  columns: ['Index', 'Title', 'Subtitle', 'Type'],
  args: [
    {
      name: 'query',
      positional: true,
      required: true,
      help: 'Search query keyword, username, or text',
    },
    {
      name: 'limit',
      positional: false,
      required: false,
      default: 10,
      help: 'Maximum search results (default: 10)',
    },
  ],
  func: async (page, kwargs) => {
    const query = String(kwargs.query || '');
    const limit = Number(kwargs.limit || 10);

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      const input = document.querySelector('#LeftColumn input.form-control');
      if (!input) return { ok: false, error: 'Search input tidak ditemukan.' };

      input.focus();
      input.select();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, ${JSON.stringify(query)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

      await sleep(1500);

      // Collect search results
      const results = Array.from(document.querySelectorAll('#LeftColumn .ListItem')).slice(0, ${limit});
      const data = results.map((el, i) => {
        const titleEl = el.querySelector('.title, .fullName, .user-title');
        const subtitleEl = el.querySelector('.subtitle, .last-message');
        const title = titleEl ? titleEl.innerText.trim() : el.innerText.trim();
        const subtitle = subtitleEl ? subtitleEl.innerText.trim().replace(/\\n/g, ' ') : '';

        let type = 'Chat/Contact';
        if (title.toLowerCase().includes('bot') || subtitle.toLowerCase().includes('bot')) type = 'Bot';
        else if (subtitle.toLowerCase().includes('subscriber') || subtitle.toLowerCase().includes('member')) type = 'Channel/Group';

        return {
          Index: i + 1,
          Title: title,
          Subtitle: subtitle.length > 80 ? subtitle.slice(0, 77) + '...' : subtitle,
          Type: type,
        };
      });

      // Cleanup search input
      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      return { ok: true, data };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Pencarian gagal dilakukan.');
    }

    return res.data;
  },
});
