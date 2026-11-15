import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { WHATSAPP_DOMAIN, WA_BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'whatsapp',
  name: 'read',
  description: 'Read recent messages and attachment details from active WhatsApp chat or contact',
  access: 'read',
  domain: WHATSAPP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Time', 'Sender', 'Message', 'Attachment'],
  args: [
    {
      name: 'target',
      positional: true,
      required: false,
      help: 'Target contact, phone number, group, or "me" (leave empty for currently open chat)',
    },
    {
      name: 'limit',
      positional: false,
      required: false,
      default: 20,
      help: 'Number of recent messages to read (default: 20)',
    },
    {
      name: 'output',
      positional: false,
      required: false,
      help: 'Optional file path to export transcript (e.g. ./wa_chat.md or ./wa_chat.json)',
    },
  ],
  func: async (page, kwargs) => {
    const target = String(kwargs.target || '');
    const limit = Number(kwargs.limit || 20);
    const outputPath = kwargs.output ? path.resolve(String(kwargs.output)) : null;

    const script = `(async () => {
      ${WA_BROWSER_HELPERS_JS}

      if (${JSON.stringify(target)}) {
        const openRes = await openChat(${JSON.stringify(target)});
        if (!openRes.ok) return { ok: false, error: openRes.error };
        await sleep(1200);
      }

      const main = document.getElementById('main');
      if (!main) return { ok: false, error: 'Tidak ada obrolan aktif di WhatsApp Web.' };

      const chatTitle = getActiveChatTitle() || 'WhatsApp Chat';
      const msgRows = Array.from(main.querySelectorAll('.message-in, .message-out, div[role="row"]')).slice(-${limit});

      const messages = msgRows.map((r, i) => {
        const isOut = r.classList.contains('message-out') || r.querySelector('.message-out');
        const sender = isOut ? 'You' : chatTitle;

        // Extract time
        const timeEl = r.querySelector('[data-pre-plain-text], span[dir="auto"].x1rg5ohu, .copyable-text');
        let timeStr = '';
        const prePlainText = timeEl?.getAttribute('data-pre-plain-text') || '';
        const matchTime = prePlainText.match(/\\[([^\\]]+)\\]/);
        if (matchTime) {
          timeStr = matchTime[1];
        } else {
          const timeSpan = r.querySelector('span[dir="ltr"]');
          timeStr = timeSpan ? timeSpan.innerText.trim() : '';
        }

        // Extract text
        const textEl = r.querySelector('.selectable-text, span.selectable-text, span[dir="ltr"]');
        let text = textEl ? textEl.innerText.trim() : r.innerText.trim();

        // Check media/attachments
        let attachment = 'None';
        if (r.querySelector('img[src*="blob:"], img[src*="data:"]')) attachment = 'Photo/Image';
        else if (r.querySelector('video')) attachment = 'Video';
        else if (r.querySelector('audio, [data-icon*="audio"], [data-icon*="ptt"]')) attachment = 'Voice Note / Audio';
        else if (r.querySelector('[data-icon*="document"], [title*="PDF"], [title*="doc"]')) attachment = 'Document';

        return {
          Index: i + 1,
          Time: timeStr || '--:--',
          Sender: sender,
          Message: text.replace(/\\n+/g, ' '),
          FullMessage: text,
          Attachment: attachment,
        };
      });

      return {
        ok: true,
        chatTitle,
        messages,
      };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal membaca percakapan WhatsApp.');
    }

    const { chatTitle, messages } = res;

    if (outputPath) {
      const ext = path.extname(outputPath).toLowerCase();
      let fileBody = '';

      if (ext === '.json') {
        fileBody = JSON.stringify({ chat: chatTitle, exportedAt: new Date().toISOString(), messages }, null, 2);
      } else {
        fileBody = `# WhatsApp Transcript: ${chatTitle}\n` +
          `*Exported at:* ${new Date().toLocaleString()}\n` +
          `*Total Messages:* ${messages.length}\n\n---\n\n` +
          messages.map((m) => `**[${m.Time}] ${m.Sender}:**\n${m.FullMessage || m.Message}\n${m.Attachment !== 'None' ? `*Attachment:* ${m.Attachment}\n` : ''}`).join('\n\n');
      }

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, fileBody, 'utf8');

      return [
        {
          Time: new Date().toLocaleTimeString(),
          Sender: 'System',
          Message: `Exported ${messages.length} messages from "${chatTitle}" to: ${outputPath}`,
          Attachment: outputPath,
        },
      ];
    }

    return messages.map((m) => ({
      Time: m.Time,
      Sender: m.Sender,
      Message: m.Message.length > 80 ? m.Message.slice(0, 77) + '...' : m.Message,
      Attachment: m.Attachment,
    }));
  },
});
