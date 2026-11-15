import { cli, Strategy } from '@jackwener/opencli/registry';
import { WHATSAPP_DOMAIN, WA_BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'whatsapp',
  name: 'send',
  description: 'Send a message to a phone number (+628...), contact, group, or yourself',
  access: 'write',
  domain: WHATSAPP_DOMAIN,
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
      help: 'Phone number (e.g. 62812345678, +62...), contact name, or "me" for yourself',
    },
    {
      name: 'message',
      positional: true,
      required: true,
      help: 'Text message to send',
    },
  ],
  func: async (page, kwargs) => {
    let target = String(kwargs.target || '').trim();
    const message = String(kwargs.message || '');

    // Check if target is a phone number
    const isPhone = /^[+]?[0-9]{8,16}$/.test(target.replace(/[- ]/g, ''));
    let cleanPhone = '';
    if (isPhone) {
      cleanPhone = target.replace(/[- +]/g, '');
      if (cleanPhone.startsWith('08')) {
        cleanPhone = '628' + cleanPhone.slice(2);
      }
    }

    if (cleanPhone) {
      // Navigate directly to WhatsApp send URL
      await page.goto(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`);

      // Wait for composer and trigger send
      const sendScript = `(async () => {
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

        // Wait up to 10s for #main to appear
        for (let i = 0; i < 20; i++) {
          const main = document.getElementById('main');
          if (main) {
            await sleep(800);
            const sendBtn = main.querySelector('footer span[data-icon="send"], footer button[aria-label*="Send"], footer button[aria-label*="Kirim"]');
            if (sendBtn) {
              sendBtn.closest('button, span')?.click();
              await sleep(800);
              return { ok: true, target: '${cleanPhone}' };
            }
            const composer = main.querySelector('footer [contenteditable="true"]');
            if (composer) {
              composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
              await sleep(800);
              return { ok: true, target: '${cleanPhone}' };
            }
          }
          await sleep(500);
        }
        return { ok: false, error: 'Waktu habis menunggu chat terbuka.' };
      })()`;

      const sendRes = await page.evaluate(sendScript);
      if (!sendRes || !sendRes.ok) {
        throw new Error(sendRes?.error || 'Gagal mengirim pesan ke nomor.');
      }

      return [
        {
          Target: `+${cleanPhone}`,
          MessagePreview: message.length > 60 ? message.slice(0, 57) + '...' : message,
          Status: 'Delivered',
          SentAt: new Date().toLocaleTimeString(),
        },
      ];
    }

    // Otherwise target is contact or group name
    const script = `(async () => {
      ${WA_BROWSER_HELPERS_JS}

      const openRes = await openChat(${JSON.stringify(target)});
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1000);

      const sendRes = await sendTextMessage(${JSON.stringify(message)});
      if (!sendRes.ok) return { ok: false, error: sendRes.error };

      return {
        ok: true,
        target: openRes.title,
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
