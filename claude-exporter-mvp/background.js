chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'open_pdf_export') return;

  chrome.storage.session
    .set({
      pdfExportHtml: message.html,
      pdfExportTitle: message.pdfTitle || 'Claude-대화',
    })
    .then(() => chrome.tabs.create({ url: chrome.runtime.getURL('export-pdf.html') }))
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));

  return true;
});
