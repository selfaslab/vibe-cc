function isGenericChatTitle(title) {
  if (!title) return true;
  const n = String(title).replace(/\s+/g, '').toLowerCase();
  const generic = ['새채팅', 'newchat', 'claude', '대화', 'untitled', '제목없음', '새대화'];
  return generic.includes(n) || n.startsWith('새채팅');
}

function buildTitleFromChatLog(chatData) {
  if (!chatData?.length) return '대화';
  let combined = chatData
    .filter((m) => m.role === 'user')
    .map((m) => m.text)
    .join('');
  if (!combined.trim()) {
    combined = chatData.map((m) => m.text).join('');
  }
  combined = combined
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '');
  return combined.slice(0, 10) || '대화';
}

function sanitizeFilename(title, chatData) {
  let raw = title;
  if (isGenericChatTitle(raw) && chatData?.length) {
    raw = buildTitleFromChatLog(chatData);
  }
  if (!raw) return '대화';
  let safe = String(raw)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!safe) return '대화';
  if (safe.length > 10) safe = safe.slice(0, 10);
  return safe;
}

function getDateStamp() {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function getExportFilename(format, chatTitle, chatData) {
  const safeTitle = sanitizeFilename(chatTitle, chatData);
  const dateStamp = getDateStamp();
  const ext = { md: 'md', txt: 'txt', pdf: 'pdf', html: 'html' }[format] || 'txt';
  return `Claude-${safeTitle}-${dateStamp}.${ext}`;
}

function getExportBaseName(chatTitle, chatData) {
  const safeTitle = sanitizeFilename(chatTitle, chatData);
  return `Claude-${safeTitle}-${getDateStamp()}`;
}

function buildMarkdown(chatData, chatTitle, format) {
  const docTitle = getExportFilename(format, chatTitle, chatData);
  let content = `# ${docTitle}\n\n추출일시: ${new Date().toLocaleString('ko-KR')}\n\n---\n\n`;
  chatData.forEach((msg) => {
    const roleName = msg.role === 'user' ? '👤 User' : '🤖 Claude';
    content += `### ${roleName}\n\n${msg.text}\n\n---\n\n`;
  });
  return content;
}

function buildTxt(chatData, chatTitle, format) {
  const docTitle = getExportFilename(format, chatTitle, chatData);
  let content = `${docTitle}\n추출일시: ${new Date().toLocaleString('ko-KR')}\n\n`;
  chatData.forEach((msg) => {
    const roleName = msg.role === 'user' ? '[USER]' : '[CLAUDE]';
    content += `${roleName}\n${msg.text}\n\n${'='.repeat(40)}\n\n`;
  });
  return content;
}

function buildHtml(chatData, chatTitle, format) {
  const docTitle = getExportFilename(format || 'pdf', chatTitle, chatData);
  const displayTitle = escapeHtml(docTitle);
  const rows = chatData
    .map((msg) => {
      const roleName = msg.role === 'user' ? 'User' : 'Claude';
      const roleClass = msg.role === 'user' ? 'user' : 'assistant';
      const escaped = escapeHtml(msg.text).replace(/\n/g, '<br>');
      return `<section class="msg ${roleClass}"><h2>${roleName}</h2><div class="body">${escaped}</div></section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${displayTitle}</title>
  <style>
    body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #111; line-height: 1.6; }
    h1 { font-size: 1.4rem; border-bottom: 2px solid #4f46e5; padding-bottom: 0.5rem; }
    .meta { color: #666; font-size: 0.85rem; margin-bottom: 2rem; }
    .msg { margin-bottom: 1.5rem; padding: 1rem; border-radius: 8px; page-break-inside: avoid; }
    .user { background: #eef2ff; border-left: 4px solid #4f46e5; }
    .assistant { background: #f9fafb; border-left: 4px solid #6b7280; }
    .msg h2 { font-size: 0.9rem; margin: 0 0 0.5rem; color: #374151; }
    .body { white-space: pre-wrap; word-break: break-word; font-size: 0.95rem; }
    @media print { body { margin: 0; } .msg { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>${displayTitle}</h1>
  <p class="meta">추출일시: ${escapeHtml(new Date().toLocaleString('ko-KR'))}</p>
  ${rows}
</body>
</html>`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getExportContent(chatData, format, chatTitle) {
  if (format === 'md') {
    return { content: buildMarkdown(chatData, chatTitle, format), mimeType: 'text/markdown' };
  }
  if (format === 'txt') {
    return { content: buildTxt(chatData, chatTitle, format), mimeType: 'text/plain' };
  }
  if (format === 'html') {
    return { content: buildHtml(chatData, chatTitle, format), mimeType: 'text/html' };
  }
  return { content: buildTxt(chatData, chatTitle, 'txt'), mimeType: 'text/plain' };
}

function sendExtractMessage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'extract_chat' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractChatFromTab(tabId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response = await sendExtractMessage(tabId);
    if (response?.success) return response;

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    } catch {
      // 탭이 claude.ai가 아니거나 접근 불가
    }

    await delay(400);
    response = await sendExtractMessage(tabId);
    if (response) return response;
  }

  return { success: false, error: '추출에 실패했습니다. 대화 페이지를 새로고침 후 다시 시도해 주세요.' };
}

async function getTargetClaudeTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id && active.url?.includes('claude.ai')) return active;

  const claudeTabs = await chrome.tabs.query({ url: ['https://claude.ai/*', 'https://*.claude.ai/*'] });
  if (claudeTabs.length === 0) return null;

  return claudeTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
}

async function downloadChatFile(chatData, format, chatTitle) {
  if (format === 'pdf') {
    await downloadPdf(chatData, chatTitle);
    return;
  }

  const { content, mimeType } = getExportContent(chatData, format, chatTitle);
  const filename = getExportFilename(format, chatTitle, chatData);

  if (typeof document !== 'undefined' && document.body) {
    downloadViaAnchor(content, mimeType, filename);
    return filename;
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: false });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return filename;
}

function downloadViaAnchor(content, mimeType, filename) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function downloadPdf(chatData, chatTitle) {
  const html = buildHtml(chatData, chatTitle, 'pdf');
  const pdfTitle = getExportFilename('pdf', chatTitle, chatData);
  await chrome.runtime.sendMessage({
    action: 'open_pdf_export',
    html,
    pdfTitle,
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.ExportUtils = {
    isGenericChatTitle,
    buildTitleFromChatLog,
    sanitizeFilename,
    getExportFilename,
    getExportBaseName,
    buildMarkdown,
    buildTxt,
    buildHtml,
    getExportContent,
    extractChatFromTab,
    downloadChatFile,
    downloadViaAnchor,
    downloadPdf,
    getTargetClaudeTab,
  };
}
