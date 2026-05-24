if (!globalThis.__claudeExporterLoaded) {
  globalThis.__claudeExporterLoaded = true;
  chrome.runtime.onMessage.addListener(onExtractMessage);
}

const USER_SELECTORS = [
  '[data-testid="user-message"]',
  '[data-testid="human-message"]',
  '[data-testid="message-human"]',
  '.font-user-message',
];

const ASSISTANT_SELECTORS = [
  '[data-testid="assistant-message"]',
  '[data-testid="ai-message"]',
  '[data-testid="message-assistant"]',
  '.font-claude-response',
  '.font-claude-message',
];

const TURN_SELECTORS = [
  '[data-testid^="conversation-turn"]',
  '[data-testid^="chat-message"]',
  '[class*="ConversationTurn"]',
];

const CONTENT_ROOT_SELECTORS = [
  '.standard-markdown',
  '.progressive-markdown',
  '.prose',
  '[class*="markdown"]',
];

function onExtractMessage(request, _sender, sendResponse) {
  if (request.action !== 'extract_chat') return;

  try {
    const chatLog = extractChat();
    if (chatLog.length > 0) {
      const chatTitle = extractChatTitle(chatLog);
      sendResponse({ success: true, data: chatLog, chatTitle });
    } else {
      sendResponse({
        success: false,
        error: '대화 메시지를 찾지 못했습니다. 대화 페이지인지 확인해 주세요.',
        debug: getDebugInfo(),
      });
    }
  } catch (err) {
    sendResponse({
      success: false,
      error: err instanceof Error ? err.message : '추출 중 오류가 발생했습니다.',
    });
  }
  return true;
}

function getChatRoot() {
  return document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
}

function isInSidebar(el) {
  let node = el;
  while (node && node !== document.body) {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'nav') return true;
    const cls = String(node.className || '').toLowerCase();
    if (cls.includes('sidebar') || cls.includes('navigation')) return true;
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.width < 280 && rect.left < 20) return true;
    node = node.parentElement;
  }
  return false;
}

function extractChat() {
  const strategies = [extractByTestIds, extractByConversationTurns, extractByActionBars];
  for (const strategy of strategies) {
    const result = strategy();
    if (result.length > 0) return result;
  }
  return [];
}

function extractByTestIds() {
  const root = getChatRoot();
  const candidates = [];

  USER_SELECTORS.forEach((selector) => {
    root.querySelectorAll(selector).forEach((el) => {
      if (isInSidebar(el)) return;
      candidates.push({ el, role: 'user' });
    });
  });

  ASSISTANT_SELECTORS.forEach((selector) => {
    root.querySelectorAll(selector).forEach((el) => {
      if (isInSidebar(el)) return;
      if (el.closest(USER_SELECTORS.join(', '))) return;
      candidates.push({ el, role: 'assistant' });
    });
  });

  return finalizeCandidates(candidates);
}

function extractByConversationTurns() {
  const root = getChatRoot();
  const candidates = [];

  TURN_SELECTORS.forEach((selector) => {
    root.querySelectorAll(selector).forEach((el) => {
      if (isInSidebar(el)) return;
      const userEl = el.querySelector(USER_SELECTORS.join(', '));
      const role = userEl ? 'user' : 'assistant';
      candidates.push({ el: userEl || el, role });
    });
  });

  return finalizeCandidates(candidates);
}

function extractByActionBars() {
  const root = getChatRoot();
  const candidates = [];
  const seen = new WeakSet();

  root.querySelectorAll('[data-testid="action-bar-copy"]').forEach((btn) => {
    const turn = findTurnContainer(btn);
    if (!turn || seen.has(turn) || isInSidebar(turn)) return;
    seen.add(turn);

    const userEl = turn.querySelector(USER_SELECTORS.join(', '));
    const role = userEl ? 'user' : 'assistant';
    candidates.push({ el: userEl || turn, role });
  });

  return finalizeCandidates(candidates);
}

function findTurnContainer(actionBarEl) {
  let el = actionBarEl.parentElement;
  let lastGood = el;

  for (let i = 0; i < 25 && el && el !== document.body; i++) {
    const userCount = el.querySelectorAll(USER_SELECTORS.join(', ')).length;
    const copyCount = el.querySelectorAll('[data-testid="action-bar-copy"]').length;
    const hasContent = el.querySelector(CONTENT_ROOT_SELECTORS.join(', ')) || userCount > 0;

    if (hasContent && copyCount === 1 && userCount <= 1) return el;
    if (el.querySelector(USER_SELECTORS.join(', '))) return lastGood;

    lastGood = el;
    el = el.parentElement;
  }

  return lastGood;
}

function finalizeCandidates(candidates) {
  const deduped = dedupeByContainment(candidates);
  deduped.sort((a, b) => {
    const pos = a.el.compareDocumentPosition(b.el);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  const chatLog = [];
  const seenText = new Set();

  deduped.forEach(({ el, role }) => {
    const text = extractMessageText(el, role);
    if (!text || seenText.has(text)) return;
    seenText.add(text);
    chatLog.push({ role, text });
  });

  return chatLog;
}

function dedupeByContainment(candidates) {
  const byElement = new Map();
  candidates.forEach((item) => {
    if (!byElement.has(item.el)) byElement.set(item.el, item);
  });
  const unique = [...byElement.values()];

  return unique.filter(
    (item) =>
      !unique.some((other) => other.el !== item.el && other.el.contains(item.el))
  );
}

function getContentRoot(messageEl) {
  for (const selector of CONTENT_ROOT_SELECTORS) {
    const root = messageEl.querySelector(selector);
    if (root) return root;
  }
  return messageEl;
}

function extractMessageText(messageEl, role) {
  const root = getContentRoot(messageEl);
  const clone = root.cloneNode(true);

  clone.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    const body = (code?.innerText ?? pre.innerText).trim();
    const lang = code?.className?.match(/language-(\S+)/)?.[1] ?? '';
    const opening = lang ? '```' + lang : '```';
    pre.replaceWith(document.createTextNode(`\n${opening}\n${body}\n\`\`\`\n`));
  });

  clone.querySelectorAll('.artifact-block-cell, [data-testid*="artifact"]').forEach((artifact) => {
    const label = artifact.getAttribute('aria-label') || 'Artifact';
    const body = artifact.innerText.trim();
    if (body) {
      artifact.replaceWith(document.createTextNode(`\n[${label}]\n${body}\n`));
    }
  });

  clone.querySelectorAll('button, [role="toolbar"], nav, [data-testid="action-bar-copy"]').forEach((el) => {
    el.remove();
  });

  let text = clone.innerText.replace(/\n{3,}/g, '\n\n').trim();
  if (role === 'assistant') text = text.replace(/\u200b/g, '');
  return text;
}

function getDebugInfo() {
  const root = getChatRoot();
  return {
    url: location.href,
    userMessages: root.querySelectorAll(USER_SELECTORS.join(', ')).length,
    copyButtons: root.querySelectorAll('[data-testid="action-bar-copy"]').length,
    assistantBlocks: root.querySelectorAll(ASSISTANT_SELECTORS.join(', ')).length,
  };
}

function isGenericChatTitle(title) {
  if (!title) return true;
  const n = title.replace(/\s+/g, '').toLowerCase();
  const generic = [
    '새채팅',
    'newchat',
    'claude',
    '대화',
    'untitled',
    '제목없음',
    '새대화',
    'newconversation',
  ];
  return generic.includes(n) || n.startsWith('새채팅');
}

function titleFromChatContent(chatLog) {
  let combined = chatLog
    .filter((m) => m.role === 'user')
    .map((m) => m.text)
    .join('');

  if (!combined.trim()) {
    combined = chatLog.map((m) => m.text).join('');
  }

  combined = combined
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '');

  return combined.slice(0, 10) || '대화';
}

function extractChatTitle(chatLog) {
  const activeChat = document.querySelector(
    'nav a[aria-current="page"], nav [aria-selected="true"], nav a[class*="bg-"]'
  );
  const sidebarTitle = activeChat?.innerText?.trim().split('\n')[0];
  if (sidebarTitle && !isGenericChatTitle(sidebarTitle)) {
    return sidebarTitle;
  }

  const titleSelectors = [
    '[data-testid*="chat-title"]',
    '[data-testid*="conversation-title"]',
    'main h1',
    'main h2',
  ];

  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    const text = el?.innerText?.trim();
    if (text && !isGenericChatTitle(text)) return text;
  }

  let title = document.title
    .replace(/\s*\|\s*Claude\s*$/i, '')
    .replace(/\s*-\s*Claude\s*$/i, '')
    .trim();

  if (title && !isGenericChatTitle(title)) {
    return title;
  }

  return titleFromChatContent(chatLog);
}
