import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
}

const exportSrc = readFileSync(join(root, 'export-utils.js'), 'utf8');
const exportCtx = { globalThis: {} };
const exportFn = new Function('globalThis', `${exportSrc}\nreturn globalThis.ExportUtils;`);
const ExportUtils = exportFn(exportCtx);

assert(ExportUtils.sanitizeFilename('새 채팅', [{ role: 'user', text: '파일명 규칙 개선해줘' }]) === '파일명규칙개선해줘', 'generic title uses chat text');
assert(ExportUtils.sanitizeFilename('React 훅 정리!', []) === 'React훅정리!', 'real title unchanged');
assert(ExportUtils.getExportFilename('md', '테스트 채팅').startsWith('Claude-'), 'filename prefix');
assert(ExportUtils.getExportFilename('txt', '테스트').endsWith('.txt'), 'txt ext');
assert(/\d{6}\.md$/.test(ExportUtils.getExportFilename('md', '테스트')), 'YYMMDD date');

const mdName = ExportUtils.getExportFilename('md', 'React 훅 정리');
const txtName = ExportUtils.getExportFilename('txt', 'React 훅 정리');
const pdfBase = ExportUtils.getExportBaseName('React 훅 정리');
assert(mdName === txtName.replace('.txt', '.md') || mdName.includes('React훅정리'), 'md/txt same title part');
assert(pdfBase === mdName.replace('.md', ''), 'pdf base matches md without ext');

console.log(`PASS: ${passed} checks OK`);
console.log('Sample:', ExportUtils.getExportFilename('md', 'React 훅 정리'));
