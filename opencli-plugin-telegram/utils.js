export const TELEGRAM_DOMAIN = 'web.telegram.org';
export const TELEGRAM_WEB_URL = 'https://web.telegram.org/a/';

/**
 * Client-side script string injected into Telegram Web A tab
 */
export const BROWSER_HELPERS_JS = `
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function findChatElement(targetQuery) {
  const q = String(targetQuery || '').trim().toLowerCase();
  const items = Array.from(document.querySelectorAll('#LeftColumn .ListItem'));
  if (!items.length) return null;

  for (const item of items) {
    const titleEl = item.querySelector('.title, .fullName, .user-title');
    const titleText = (titleEl ? titleEl.innerText : item.innerText).toLowerCase();
    if (titleText.includes(q)) return item;
  }
  return null;
}

async function searchAndFindChat(targetQuery) {
  const input = document.getElementById('telegram-search-input') || document.querySelector('#LeftColumn input.form-control');
  if (!input) return null;

  const q = String(targetQuery || '').trim();
  const searchQ = q.startsWith('@') ? q : '@' + q;

  input.focus();
  input.click();
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(input, searchQ);
  } else {
    input.value = searchQ;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  const cleanQ = q.replace(/^@/, '').toLowerCase();

  // Poll up to 4s for Telegram global search results to render
  for (let step = 0; step < 8; step++) {
    await sleep(500);
    const results = Array.from(document.querySelectorAll('#LeftColumn .chat-item-clickable, #LeftColumn .ListItem, #LeftColumn [class*="chat-item"]'));
    const found = results.find(r => {
      const text = r.innerText.toLowerCase();
      return text.includes(cleanQ);
    });
    if (found) return found;
  }

  return null;
}

async function openChat(targetQuery) {
  const mid = document.getElementById('MiddleColumn');
  const activeTitle = getActiveChatTitle();

  // If no target given, use currently active chat
  if (!targetQuery) {
    if (activeTitle) return { ok: true, title: activeTitle, activeAlready: true };
    return { ok: false, error: 'Tidak ada chat yang sedang aktif dibuka di Telegram Web.' };
  }

  // If already open
  if (activeTitle && activeTitle.toLowerCase().includes(targetQuery.toLowerCase())) {
    return { ok: true, title: activeTitle, activeAlready: true };
  }

  // 1. Try visible sidebar
  let item = findChatElement(targetQuery);

  // 2. Fallback: Search bar (with global search wait)
  if (!item) {
    item = await searchAndFindChat(targetQuery);
  }

  if (!item) {
    return { ok: false, error: 'Chat/kontak/bot "' + targetQuery + '" tidak ditemukan di chat list maupun Global Search.' };
  }

  const btn = item.querySelector('a.ListItem-button, button, div.ListItem-button') || item;
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  btn.click();
  await sleep(1500);

  // Clear search bar so left column resets
  const searchInput = document.querySelector('#LeftColumn input.form-control');
  if (searchInput && searchInput.value) {
    searchInput.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(300);
  }

  const finalTitle = getActiveChatTitle() || item.querySelector('.title, .fullName')?.innerText?.trim() || targetQuery;
  return { ok: true, title: finalTitle };
}

function getActiveChatTitle() {
  const mid = document.getElementById('MiddleColumn');
  if (!mid) return '';
  const titleEl = mid.querySelector('.ChatInfo .fullName, .ChatInfo .title, h3.fullName, .chat-info .title');
  return titleEl ? titleEl.innerText.trim() : '';
}

function getMessageScrollContainer() {
  const mid = document.getElementById('MiddleColumn');
  if (!mid) return null;
  const candidates = Array.from(mid.querySelectorAll('.messages-container, .MessageList, .custom-scroll, div[class*="messages"]'));
  for (const el of candidates) {
    if (el.scrollHeight > el.clientHeight) return el;
  }
  return mid.querySelector('.messages-container') || mid.querySelector('.MessageList') || mid;
}

function parseMessageElement(m, index) {
  const timeEl = m.querySelector('.message-time, .time');
  const senderEl = m.querySelector('.message-title, .sender-title, .user-name');
  const textEl = m.querySelector('.message-content, .text-content');
  const links = Array.from(m.querySelectorAll('a[href]'))
    .map(a => a.getAttribute('href'))
    .filter(h => h && h.startsWith('http'));

  const time = timeEl ? timeEl.innerText.trim() : '';
  const sender = senderEl ? senderEl.innerText.trim() : (m.classList.contains('own') ? 'You' : 'Target');
  let content = textEl ? textEl.innerText.trim() : m.innerText.trim();
  if (time && content.endsWith(time)) {
    content = content.slice(0, -time.length).trim();
  }

  const id = m.getAttribute('data-message-id') || (time + '_' + sender + '_' + content.slice(0, 30));

  return {
    id,
    Index: index + 1,
    Time: time,
    Sender: sender,
    Content: content.replace(/\\n+/g, ' '),
    FullContent: content,
    Links: links.join(', '),
  };
}

async function loadMessageHistory(targetCount, maxScrollTries = 8) {
  const scrollContainer = getMessageScrollContainer();
  const collectedMap = new Map();

  for (let tryNum = 0; tryNum < maxScrollTries; tryNum++) {
    const currentMsgs = Array.from(document.querySelectorAll('#MiddleColumn .Message'));
    for (let i = 0; i < currentMsgs.length; i++) {
      const parsed = parseMessageElement(currentMsgs[i], i);
      if (!collectedMap.has(parsed.id)) {
        collectedMap.set(parsed.id, parsed);
      }
    }

    if (collectedMap.size >= targetCount) break;

    // Scroll up to trigger virtualized backfill
    if (scrollContainer) {
      const prevTop = scrollContainer.scrollTop;
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      await sleep(600);
      // If scrollTop didn't change or no more messages, break early
      if (scrollContainer.scrollTop === prevTop && prevTop === 0 && tryNum > 1) {
        break;
      }
    } else {
      break;
    }
  }

  const allItems = Array.from(collectedMap.values());
  return allItems.slice(-targetCount);
}

async function sendTextMessage(text) {
  let input = document.querySelector('#editable-message-text');

  // If input not immediately visible, check for bot START button or wait briefly
  if (!input) {
    const startBtn = document.querySelector('button.chat-input-control, .bottom-button, button.btn-primary, [class*="chat-input-control"]');
    if (startBtn && (text.toLowerCase().includes('/start') || startBtn.innerText.toLowerCase().includes('start') || startBtn.innerText.toLowerCase().includes('mulai'))) {
      startBtn.click();
      await sleep(1500);
      return { ok: true, startedBot: true };
    }

    for (let i = 0; i < 5; i++) {
      await sleep(300);
      input = document.querySelector('#editable-message-text');
      if (input) break;
    }
  }

  if (!input) return { ok: false, error: 'Composer input (#editable-message-text) tidak ditemukan.' };

  input.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, text);
  await sleep(400);

  const sendBtn = document.querySelector('.main-button.send, .btn-send, [title*="Send Message"], [aria-label*="Send Message"]');
  if (sendBtn && !sendBtn.disabled) {
    sendBtn.click();
    await sleep(600);
    return { ok: true };
  }

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  await sleep(600);
  return { ok: true };
}
`;
