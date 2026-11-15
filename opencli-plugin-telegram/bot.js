import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'bot',
  description: 'Send a command to a Telegram Bot and read its response with inline buttons',
  access: 'write',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Bot', 'Command', 'BotResponse', 'InlineButtons'],
  args: [
    {
      name: 'bot',
      positional: true,
      required: true,
      help: 'Target bot name or username (e.g. "fizatalkbot")',
    },
    {
      name: 'command',
      positional: true,
      required: true,
      help: 'Bot command or prompt (e.g. "/start", "/help", "menu")',
    },
    {
      name: 'wait',
      positional: false,
      required: false,
      default: 3,
      help: 'Seconds to wait for bot response (default: 3)',
    },
  ],
  func: async (page, kwargs) => {
    const bot = String(kwargs.bot || '');
    const cmd = String(kwargs.command || '');
    const waitSec = Number(kwargs.wait || 3);

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      // 1. Open bot chat
      const openRes = await openChat(${JSON.stringify(bot)});
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1000);

      const beforeCount = document.querySelectorAll('#MiddleColumn .Message').length;

      // 2. Send command
      const sendRes = await sendTextMessage(${JSON.stringify(cmd)});
      if (!sendRes.ok) return { ok: false, error: sendRes.error };

      // 3. Wait for reply
      await sleep(${waitSec * 1000});

      const msgs = Array.from(document.querySelectorAll('#MiddleColumn .Message'));
      const latestMsg = msgs[msgs.length - 1];

      let botText = 'No reply received within timeout';
      let buttons = [];

      if (latestMsg) {
        const textEl = latestMsg.querySelector('.message-content, .text-content');
        botText = textEl ? textEl.innerText.trim().replace(/\\n+/g, ' ') : latestMsg.innerText.trim();

        const btnEls = Array.from(latestMsg.querySelectorAll('button, .reply-markup button, .InlineButtons button'));
        buttons = btnEls.map(b => b.innerText.trim()).filter(Boolean);
      }

      return {
        ok: true,
        botTitle: openRes.title || ${JSON.stringify(bot)},
        response: botText,
        buttons: buttons.join(' | ') || 'None',
      };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal berkomunikasi dengan bot.');
    }

    return [
      {
        Bot: res.botTitle,
        Command: cmd,
        BotResponse: res.response.length > 100 ? res.response.slice(0, 97) + '...' : res.response,
        InlineButtons: res.buttons,
      },
    ];
  },
});
