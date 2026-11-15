import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'feed',
  description: 'Read and dump recent posts/messages from a Telegram channel, group, or chat',
  access: 'read',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  columns: ['Index', 'Time', 'Sender', 'Content', 'Links'],
  args: [
    {
      name: 'target',
      positional: true,
      required: true,
      help: 'Target channel, group, or chat title (e.g. "Tech & AI News", "Repo Maniac")',
    },
    {
      name: 'limit',
      positional: false,
      required: false,
      default: 10,
      help: 'Number of recent messages to fetch (default: 10)',
    },
  ],
  func: async (page, kwargs) => {
    const target = String(kwargs.target || '');
    const limit = Number(kwargs.limit || 10);

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      // Open target chat
      const openRes = await openChat(${JSON.stringify(target)});
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1500);

      // Extract messages
      const msgs = Array.from(document.querySelectorAll('#MiddleColumn .Message')).slice(-${limit});
      const data = msgs.map((m, i) => {
        const timeEl = m.querySelector('.message-time, .time');
        const senderEl = m.querySelector('.message-title, .sender-title, .user-name');
        const textEl = m.querySelector('.message-content, .text-content');
        const links = Array.from(m.querySelectorAll('a[href]'))
          .map(a => a.getAttribute('href'))
          .filter(h => h && h.startsWith('http'));

        let content = textEl ? textEl.innerText.trim() : m.innerText.trim();
        const time = timeEl ? timeEl.innerText.trim() : '';

        return {
          Index: i + 1,
          Time: time,
          Sender: senderEl ? senderEl.innerText.trim() : 'Channel/Target',
          Content: content.replace(/\\n+/g, ' '),
          Links: links.join(', '),
        };
      });

      return { ok: true, data };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal membaca feed channel.');
    }

    return res.data.map((m) => ({
      Index: m.Index,
      Time: m.Time,
      Sender: m.Sender,
      Content: m.Content.length > 100 ? m.Content.slice(0, 97) + '...' : m.Content,
      Links: m.Links.length > 50 ? m.Links.slice(0, 47) + '...' : m.Links,
    }));
  },
});
