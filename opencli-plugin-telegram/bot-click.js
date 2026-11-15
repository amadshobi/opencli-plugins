import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'bot-click',
  description: 'Click an Inline Keyboard button on a Telegram Bot message',
  access: 'write',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Bot', 'ClickedButton', 'Status', 'Timestamp'],
  args: [
    {
      name: 'bot',
      positional: true,
      required: true,
      help: 'Target bot name or username (e.g. "fizatalkbot")',
    },
    {
      name: 'button',
      positional: true,
      required: true,
      help: 'Text of the inline button to click',
    },
  ],
  func: async (page, kwargs) => {
    const bot = String(kwargs.bot || '');
    const buttonText = String(kwargs.button || '').toLowerCase();

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      // 1. Open bot chat
      const openRes = await openChat(${JSON.stringify(bot)});
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1000);

      // 2. Find inline buttons in recent messages
      const msgs = Array.from(document.querySelectorAll('#MiddleColumn .Message')).slice(-5);
      let targetButton = null;
      let matchedLabel = '';

      for (let i = msgs.length - 1; i >= 0; i--) {
        const btns = Array.from(msgs[i].querySelectorAll('button, .reply-markup button, .InlineButtons button'));
        for (const b of btns) {
          const t = b.innerText.trim();
          if (t.toLowerCase().includes(${JSON.stringify(buttonText)})) {
            targetButton = b;
            matchedLabel = t;
            break;
          }
        }
        if (targetButton) break;
      }

      if (!targetButton) {
        return { ok: false, error: 'Tombol dengan teks "' + ${JSON.stringify(buttonText)} + '" tidak ditemukan pada pesan bot.' };
      }

      targetButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      targetButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      targetButton.click();
      await sleep(1000);

      return {
        ok: true,
        botTitle: openRes.title || ${JSON.stringify(bot)},
        clicked: matchedLabel,
        time: new Date().toLocaleTimeString(),
      };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal mengeklik tombol bot.');
    }

    return [
      {
        Bot: res.botTitle,
        ClickedButton: res.clicked,
        Status: 'Clicked Successfully',
        Timestamp: res.time,
      },
    ];
  },
});
