import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { TELEGRAM_DOMAIN, BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'telegram',
  name: 'save',
  description: 'Quickly save a note, code snippet, or text file to Telegram Saved Messages (Cloud Depot)',
  access: 'write',
  domain: TELEGRAM_DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  siteSession: 'persistent',
  columns: ['Item', 'Type', 'Size', 'Status', 'SavedAt'],
  args: [
    {
      name: 'content',
      positional: true,
      required: true,
      help: 'Text to save, or path to a local text/code file',
    },
    {
      name: 'caption',
      positional: false,
      required: false,
      help: 'Optional caption or title to precede the saved content',
    },
  ],
  func: async (page, kwargs) => {
    let rawContent = String(kwargs.content || '');
    const caption = kwargs.caption ? String(kwargs.caption) + '\n\n' : '';
    let itemType = 'Note / Text';
    let itemName = 'Quick Note';
    let messageToSend = '';

    // Check if input is a local file
    const resolvedPath = path.resolve(rawContent);
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      itemType = 'File';
      itemName = path.basename(resolvedPath);
      const ext = path.extname(resolvedPath).slice(1) || '';
      try {
        const fileData = fs.readFileSync(resolvedPath, 'utf8');
        messageToSend = `${caption}📄 File: ${itemName}\n\`\`\`${ext}\n${fileData}\n\`\`\``;
      } catch {
        messageToSend = `${caption}📄 File: ${itemName} (${resolvedPath})`;
      }
    } else {
      messageToSend = `${caption}${rawContent}`;
    }

    const script = `(async () => {
      ${BROWSER_HELPERS_JS}

      // Open Saved Messages
      const openRes = await openChat('Saved Messages');
      if (!openRes.ok) return { ok: false, error: openRes.error };

      await sleep(1000);

      // Send to Saved Messages
      const sendRes = await sendTextMessage(${JSON.stringify(messageToSend)});
      if (!sendRes.ok) return { ok: false, error: sendRes.error };

      await sleep(500);

      return {
        ok: true,
        time: new Date().toLocaleTimeString(),
      };
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal menyimpan ke Saved Messages.');
    }

    return [
      {
        Item: itemName,
        Type: itemType,
        Size: `${Buffer.byteLength(messageToSend, 'utf8')} bytes`,
        Status: 'Saved to Cloud',
        SavedAt: res.time,
      },
    ];
  },
});
