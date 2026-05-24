(async function renderPdfPage() {
  const loading = document.getElementById('loading');

  try {
    const data = await chrome.storage.session.get(['pdfExportHtml', 'pdfExportTitle']);
    const html = data.pdfExportHtml;
    const pdfTitle = data.pdfExportTitle;

    if (!html) {
      loading.textContent = '보낼 내용이 없습니다. 다시 시도해 주세요.';
      return;
    }

    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.title = pdfTitle || parsed.title || 'Claude-대화';

    parsed.head.querySelectorAll('style').forEach((style) => {
      document.head.appendChild(style.cloneNode(true));
    });

    document.body.innerHTML = parsed.body.innerHTML;
    await chrome.storage.session.remove(['pdfExportHtml', 'pdfExportTitle']);

    setTimeout(() => window.print(), 500);
  } catch {
    loading.textContent = 'PDF 생성 중 오류가 발생했습니다.';
  }
})();
