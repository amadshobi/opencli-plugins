export const WHATSAPP_DOMAIN = 'web.whatsapp.com';
export const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/';

/**
 * Client-side helper scripts injected into WhatsApp Web tab
 */
export const WA_BROWSER_HELPERS_JS = `
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getActiveChatTitle() {
  const main = document.getElementById('main');
  if (!main) return '';
  const header = main.querySelector('header');
  if (!header) return '';
  const titleEl = header.querySelector('span[title], [dir="auto"]');
  return titleEl ? titleEl.innerText.trim() : '';
}

function findChatElement(targetQuery) {
  const q = String(targetQuery || '').trim().toLowerCase();
  const pane = document.getElementById('pane-side');
  if (!pane) return null;

  // Check message-yourself-row
  if (q === 'me' || q === 'yourself' || q.includes('diri sendiri')) {
    const meRow = pane.querySelector('[data-testid="message-yourself-row"]');
    if (meRow) return meRow;
  }

  const rows = Array.from(pane.querySelectorAll('[data-testid="cell-frame-container"], div[role="row"]'));
  for (const row of rows) {
    const text = row.innerText.toLowerCase();
    const titleEl = row.querySelector('span[title], span[dir="auto"]');
    const title = titleEl ? (titleEl.getAttribute('title') || titleEl.innerText).toLowerCase() : text;
    if (title.includes(q) || text.includes(q)) {
      return row;
    }
  }
  return null;
}

async function searchAndOpenChat(targetQuery) {
  const searchInput = document.querySelector('div[contenteditable="true"][data-tab="3"], [aria-label*="Cari"], [aria-label*="Search"]');
  if (!searchInput) return null;

  searchInput.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, targetQuery);
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(1200);

  const pane = document.getElementById('pane-side');
  if (!pane) return null;

  const results = Array.from(pane.querySelectorAll('[data-testid="cell-frame-container"], div[role="row"]'));
  return results.length > 0 ? results[0] : null;
}

async function openChat(targetQuery) {
  const currentTitle = getActiveChatTitle();

  // If no target provided, use currently active chat
  if (!targetQuery) {
    if (currentTitle) return { ok: true, title: currentTitle, activeAlready: true };
    return { ok: false, error: 'Tidak ada chat yang sedang aktif dibuka di WhatsApp Web.' };
  }

  // Already open
  if (currentTitle && currentTitle.toLowerCase().includes(targetQuery.toLowerCase())) {
    return { ok: true, title: currentTitle, activeAlready: true };
  }

  // 1. Try visible sidebar
  let row = findChatElement(targetQuery);

  // 2. Fallback: Search input
  if (!row) {
    row = await searchAndOpenChat(targetQuery);
  }

  if (!row) {
    return { ok: false, error: 'Kontak atau obrolan "' + targetQuery + '" tidak ditemukan di WhatsApp Web.' };
  }

  const clickable = row.querySelector('[tabindex="0"], [tabindex="-1"]') || row;
  clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  clickable.click();
  await sleep(1500);

  const finalTitle = getActiveChatTitle() || targetQuery;
  return { ok: true, title: finalTitle };
}

async function sendTextMessage(text) {
  const main = document.getElementById('main');
  if (!main) return { ok: false, error: 'Chat tidak aktif.' };

  const composer = main.querySelector('footer [contenteditable="true"]');
  if (!composer) return { ok: false, error: 'Input chat (composer) tidak ditemukan.' };

  composer.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, text);
  await sleep(400);

  const sendBtn = main.querySelector('footer span[data-icon="send"], footer button[aria-label*="Send"], footer button[aria-label*="Kirim"]');
  if (sendBtn) {
    sendBtn.closest('button, span')?.click();
    await sleep(600);
    return { ok: true };
  }

  composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  await sleep(600);
  return { ok: true };
}
`;
