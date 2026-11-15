import { cli, Strategy } from '@jackwener/opencli/registry';
import { WHATSAPP_DOMAIN, WA_BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'whatsapp',
  name: 'status',
  description: 'Check WhatsApp Web connection, active session, and current open chat',
  access: 'read',
  domain: WHATSAPP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Service', 'LoggedIn', 'ActiveChat', 'LoadedChats', 'URL', 'Status'],
  args: [],
  func: async (page) => {
    const script = `(async () => {
      ${WA_BROWSER_HELPERS_JS}

      // Settle wait if loading
      for (let i = 0; i < 10; i++) {
        if (document.getElementById('pane-side') || document.querySelector('[data-testid="qrcode"], canvas[aria-label*="QR"]')) {
          break;
        }
        await sleep(400);
      }

      const hasQr = !!document.querySelector('canvas[aria-label*="QR"], [data-ref], [data-testid="qrcode"]');
      const pane = document.getElementById('pane-side');
      const chats = pane ? pane.querySelectorAll('[data-testid="cell-frame-container"], div[role="row"]').length : 0;
      const activeChat = getActiveChatTitle() || 'None';

      const isLoggedIn = !!pane && !hasQr;

      return {
        isLoggedIn,
        activeChat,
        chatsCount: chats,
        currentUrl: window.location.href,
      };
    })()`;

    const data = await page.evaluate(script);

    return [
      {
        Service: 'WhatsApp Web',
        LoggedIn: data.isLoggedIn ? 'Yes (Connected)' : 'No (Scan QR Code)',
        ActiveChat: data.activeChat,
        LoadedChats: data.chatsCount,
        URL: data.currentUrl,
        Status: data.isLoggedIn ? 'Ready & Active' : 'Session Not Ready',
      },
    ];
  },
});
