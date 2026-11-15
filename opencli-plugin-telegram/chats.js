import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN } from './utils.js';

cli({
  site: 'telegram',
  name: 'chats',
  description: 'List recent chats, channels, bots, and unread counters from Telegram sidebar',
  access: 'read',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  columns: ['Index', 'Title', 'Unread', 'Time', 'LastMessage'],
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

    const chatItems = await page.evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('#LeftColumn .ListItem')).slice(0, ${limit});
      return items.map((el, i) => {
        const titleEl = el.querySelector('.title, .fullName, .user-title');
        const subtitleEl = el.querySelector('.subtitle, .last-message');
        const badgeEl = el.querySelector('.badge, .unread, .chat-badge');
        const timeEl = el.querySelector('.time, .message-time');

        const title = titleEl ? titleEl.innerText.trim() : 'Unknown';
        const lastMsg = subtitleEl ? subtitleEl.innerText.trim().replace(/\\n/g, ' ') : '';
        const unread = badgeEl ? badgeEl.innerText.trim() : '0';
        const time = timeEl ? timeEl.innerText.trim() : '';

        return {
          Index: i + 1,
          Title: title,
          Unread: unread,
          Time: time,
          LastMessage: lastMsg.length > 80 ? lastMsg.slice(0, 77) + '...' : lastMsg,
        };
      });
    })()`);

    return chatItems;
  },
});
