import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'read',
  description: 'Read and auto-scroll message history from active chat, group, or channel with file export',
  access: 'read',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Time', 'Sender', 'Message', 'Links'],
  args: [
    {
      name: 'target',
      positional: true,
      required: false,
      help: 'Target chat, group, bot, or channel name (leave empty to read currently active open chat)',
    },
    {
      name: 'limit',
      positional: false,
      required: false,
      default: 20,
      help: 'Number of recent messages to read (default: 20, auto-scrolls for long history)',
    },
    {
      name: 'output',
      positional: false,
      required: false,
      help: 'Optional file path to export chat transcript (e.g. ./chat.md or ./chat.json)',
    },
  ],
  func: async (page, kwargs) => {
    const target = String(kwargs.target || '');
    const limit = Number(kwargs.limit || 20);
    const outputPath = kwargs.output ? path.resolve(String(kwargs.output)) : null;

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      // 1. Open chat (or use currently open one)
      const openRes = await openChat(${JSON.stringify(target)});
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1000);

      // 2. Auto-scroll and load requested history count
      const messages = await loadMessageHistory(${limit});

      return {
        ok: true,
        chatTitle: openRes.title,
        messages,
      };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal membaca percakapan.');
    }

    const { chatTitle, messages } = res;

    // Handle direct file export if --output is specified
    if (outputPath) {
      const ext = path.extname(outputPath).toLowerCase();
      let fileBody = '';

      if (ext === '.json') {
        fileBody = JSON.stringify({ chat: chatTitle, exportedAt: new Date().toISOString(), messages }, null, 2);
      } else {
        // Markdown transcript
        fileBody = `# Chat Transcript: ${chatTitle}\n` +
          `*Exported at:* ${new Date().toLocaleString()}\n` +
          `*Total Messages:* ${messages.length}\n\n---\n\n` +
          messages.map((m) => `**[${m.Time || '--:--'}] ${m.Sender}:**\n${m.FullContent || m.Content}\n${m.Links ? `> Links: ${m.Links}\n` : ''}`).join('\n\n');
      }

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, fileBody, 'utf8');

      return [
        {
          Time: new Date().toLocaleTimeString(),
          Sender: 'System',
          Message: `Exported ${messages.length} messages from "${chatTitle}" to: ${outputPath}`,
          Links: outputPath,
        },
      ];
    }

    return messages.map((m) => ({
      Time: m.Time || '--:--',
      Sender: m.Sender,
      Message: m.Content.length > 100 ? m.Content.slice(0, 97) + '...' : m.Content,
      Links: m.Links.length > 50 ? m.Links.slice(0, 47) + '...' : m.Links,
    }));
  },
});
