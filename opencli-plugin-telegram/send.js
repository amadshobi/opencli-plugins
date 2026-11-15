import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'send',
  description: 'Send a message to a contact, channel, group, bot, or Saved Messages',
  access: 'write',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Target', 'MessagePreview', 'Status', 'SentAt'],
  args: [
    {
      name: 'target',
      positional: true,
      required: true,
      help: 'Target chat, channel, bot, or "Saved Messages"',
    },
    {
      name: 'message',
      positional: true,
      required: true,
      help: 'Message text to send',
    },
  ],
  func: async (page, kwargs) => {
    const target = String(kwargs.target || '');
    const message = String(kwargs.message || '');

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      // 1. Open target chat
      const openRes = await openChat(${JSON.stringify(target)});
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1000);

      // 2. Send text message
      const sendRes = await sendTextMessage(${JSON.stringify(message)});
      if (!sendRes.ok) return { ok: false, error: sendRes.error };

      await sleep(500);

      return {
        ok: true,
        target: openRes.title || ${JSON.stringify(target)},
        time: new Date().toLocaleTimeString(),
      };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal mengirim pesan.');
    }

    return [
      {
        Target: res.target,
        MessagePreview: message.length > 60 ? message.slice(0, 57) + '...' : message,
        Status: 'Delivered',
        SentAt: res.time,
      },
    ];
  },
});
