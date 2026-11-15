import { cli, Strategy } from '@jackwener/opencli/registry';
import { WHATSAPP_DOMAIN, WA_BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'whatsapp',
  name: 'chats',
  description: 'List recent conversations and unread badges from WhatsApp Web sidebar',
  access: 'read',
  domain: WHATSAPP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Index', 'Contact', 'Unread', 'LastMessage'],
  args: [
    {
      name: 'limit',
      positional: false,
      required: false,
      default: 15,
      help: 'Maximum number of chats to list (default: 15)',
    },
  ],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit || 15);

    const script = `(async () => {
      ${WA_BROWSER_HELPERS_JS}

      for (let i = 0; i < 10; i++) {
        if (document.getElementById('pane-side')) break;
        await sleep(400);
      }

      const pane = document.getElementById('pane-side');
      if (!pane) return [];

      const rows = Array.from(pane.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="message-yourself-row"], div[role="row"]')).slice(0, ${limit});

      return rows.map((r, i) => {
        const titleEl = r.querySelector('span[title], span[dir="auto"]');
        const textLines = r.innerText.split('\\n').map(l => l.trim()).filter(Boolean);

        let contact = titleEl ? (titleEl.getAttribute('title') || titleEl.innerText) : (textLines[0] || 'Unknown');
        if (r.getAttribute('data-testid') === 'message-yourself-row') {
          contact = contact + ' (You / Saved)';
        }

        const unreadBadge = r.querySelector('[aria-label*="unread"], [aria-label*="belum dibaca"]');
        const unread = unreadBadge ? (unreadBadge.innerText || '1') : '0';

        const lastMsg = textLines.slice(1).join(' ').replace(/\\n+/g, ' ');

        return {
          Index: i + 1,
          Contact: contact,
          Unread: unread,
          LastMessage: lastMsg.length > 70 ? lastMsg.slice(0, 67) + '...' : lastMsg,
        };
      });
    })()`;

    const chatItems = await page.evaluate(script);
    return chatItems;
  },
});
