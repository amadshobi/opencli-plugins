import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { WHATSAPP_DOMAIN, WA_BROWSER_HELPERS_JS } from './utils.js';

cli({
  site: 'whatsapp',
  name: 'save-media',
  description: 'Download the latest photo or media attachment from a WhatsApp chat directly to disk',
  access: 'read',
  domain: WHATSAPP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  browser: true,
  siteSession: 'persistent',
  columns: ['Media', 'SourceChat', 'Size', 'Status', 'SavedTo'],
  args: [
    {
      name: 'target',
      positional: true,
      required: false,
      help: 'Target contact, group, or phone (leave empty for active open chat)',
    },
    {
      name: 'output',
      positional: false,
      required: false,
      default: './wa_media.jpg',
      help: 'Output file destination (default: ./wa_media.jpg)',
    },
  ],
  func: async (page, kwargs) => {
    const target = String(kwargs.target || '');
    const outputPath = path.resolve(String(kwargs.output || './wa_media.jpg'));

    const script = `(async () => {
      ${WA_BROWSER_HELPERS_JS}

      if (${JSON.stringify(target)}) {
        const openRes = await openChat(${JSON.stringify(target)});
        if (!openRes.ok) return { ok: false, error: openRes.error };
        await sleep(1200);
      }

      const main = document.getElementById('main');
      if (!main) return { ok: false, error: 'Tidak ada obrolan WhatsApp aktif.' };

      const chatTitle = getActiveChatTitle() || 'WhatsApp Chat';

      // Find latest media image in chat
      const imgElements = Array.from(main.querySelectorAll('img[src*="blob:"], img[src*="data:"], [data-testid="image-thumb"] img'));
      if (!imgElements.length) {
        return { ok: false, error: 'Tidak ditemukan gambar/media yang dapat diunduh pada chat ini.' };
      }

      const targetImg = imgElements[imgElements.length - 1];
      const srcUrl = targetImg.src;

      try {
        const res = await fetch(srcUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        const base64Data = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        return {
          ok: true,
          chatTitle,
          base64: base64Data.split(',')[1],
          mimeType: blob.type,
          size: blob.size,
        };
      } catch (err) {
        return { ok: false, error: 'Gagal mengekstrak binary media: ' + err.message };
      }
    })()`;

    const res = await page.evaluate(script);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Gagal mengekstrak media.');
    }

    const buffer = Buffer.from(res.base64, 'base64');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    return [
      {
        Media: 'Photo / Image',
        SourceChat: res.chatTitle,
        Size: `${(buffer.length / 1024).toFixed(1)} KB`,
        Status: 'Saved to Disk',
        SavedTo: outputPath,
      },
    ];
  },
});
