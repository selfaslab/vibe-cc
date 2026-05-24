document.getElementById('download-md').addEventListener('click', () => triggerExtraction('md'));
document.getElementById('download-txt').addEventListener('click', () => triggerExtraction('txt'));
document.getElementById('download-pdf').addEventListener('click', () => triggerExtraction('pdf'));

async function triggerExtraction(format) {
  const status = document.getElementById('status-msg');
  const buttons = document.querySelectorAll('button');
  status.textContent = '대화를 분석하는 중...';
  status.className = 'mt-3 text-xs text-gray-500 min-h-[1rem]';
  buttons.forEach((btn) => { btn.disabled = true; });

  try {
    const tab = await ExportUtils.getTargetClaudeTab();
    if (!tab?.id) {
      status.textContent = 'Claude 대화 페이지를 찾을 수 없습니다.';
      status.className = 'mt-3 text-xs text-red-500 min-h-[1rem]';
      return;
    }

    const response = await ExportUtils.extractChatFromTab(tab.id);
    if (!response?.success) {
      status.textContent = response?.error || '추출에 실패했습니다. 새로고침 후 다시 시도해 주세요.';
      status.className = 'mt-3 text-xs text-red-500 min-h-[1rem]';
      return;
    }

    const savedName = await ExportUtils.downloadChatFile(response.data, format, response.chatTitle);

    if (format === 'pdf') {
      status.textContent = 'PDF 인쇄 창이 열렸습니다. 「PDF로 저장」을 선택하세요.';
    } else {
      status.textContent = `저장됨: ${savedName || '완료'}`;
    }
    status.className = 'mt-3 text-xs text-green-600 min-h-[1rem]';
  } catch {
    status.textContent = '추출에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
    status.className = 'mt-3 text-xs text-red-500 min-h-[1rem]';
  } finally {
    buttons.forEach((btn) => { btn.disabled = false; });
  }
}
