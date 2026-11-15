import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, TELEGRAM_WEB_URL } from './utils.js';

cli({
  site: 'telegram',
  name: 'status',
  description: 'Check Telegram Web connection, active session, and loaded chats',
  access: 'read',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  columns: ['Service', 'LoggedIn', 'ActiveChat', 'LoadedChats', 'URL', 'Status'],
  args: [],
  func: async (page) => {
    const data = await page.evaluate(`(async () => {
      const isAuthPage = !!document.querySelector('.login, #auth-pages, .auth-form, input[type="tel"]');
      const chats = document.querySelectorAll('#LeftColumn .ListItem').length;
      const mid = document.getElementById('MiddleColumn');
      const midText = mid ? mid.innerText.slice(0, 150).replace(/\s+/g, ' ') : 'null';
      const activeTitle = mid?.querySelector('.ChatInfo .fullName, .ChatInfo .title, h3.fullName, .chat-info .title, .chat-info')?.innerText?.trim() || midText;

      return {
        isLoggedIn: !isAuthPage && chats > 0,
        activeChat: activeTitle,
        chatsCount: chats,
        currentUrl: window.location.href,
      };
    })()`);

    return [
      {
        Service: 'Telegram Web A',
        LoggedIn: data.isLoggedIn ? 'Yes (Active)' : 'No (Requires Login)',
        ActiveChat: data.activeChat,
        LoadedChats: data.chatsCount,
        URL: data.currentUrl,
        Status: data.isLoggedIn ? 'Ready & Connected' : 'Session Not Ready',
      },
    ];
  },
});
