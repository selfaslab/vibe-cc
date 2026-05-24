# 클로드 대화 추출기 (Claude Exporter)

[Claude.ai](https://claude.ai) 대화를 **Markdown / TXT / PDF**로 저장하는 Chrome 확장 프로그램입니다.

> Anthropic·Claude.ai와 **무관한 비공식 도구**입니다. 대화는 브라우저에서만 읽으며 **외부 서버로 전송하지 않습니다.**

**현재 버전:** 1.3.4 · 확장 소스: [`claude-exporter-mvp/`](claude-exporter-mvp/)

---

## 빠른 설치
<img width="805" height="421" alt="1" src="https://github.com/user-attachments/assets/58fdc04c-cf90-4ef0-be24-df61fcb46f12" />

1. 저장소 클론 또는 ZIP 다운로드
2. Chrome → `chrome://extensions/` → **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → `claude-exporter-mvp` 폴더 선택
4. 확장 아이콘을 툴바에 **핀** 고정

---


## 사용법
<img width="319" height="274" alt="2" src="https://github.com/user-attachments/assets/6c55bc39-1b6c-4496-aa8e-85d52d8849c8" />

1. [claude.ai](https://claude.ai)에서 저장할 **대화 페이지**(`/chat/...`)를 엽니다.
2. 확장 프로그램 **아이콘**을 클릭해 작은 팝업을 엽니다.
3. 저장 형식을 선택합니다.

| 버튼 | 결과 |
|------|------|
| **Markdown (.md)** | 바로 다운로드 |
| **텍스트 (.txt)** | 바로 다운로드 |
| **PDF (.pdf)** | 미리보기 탭 + 인쇄 창 → **「PDF로 저장」** 선택 |

- 팝업 하단에 `저장됨: Claude-...` 형태로 **실제 파일명**이 표시됩니다.
- 추출 실패 시 대화 페이지 **새로고침(F5)** 후 다시 시도하세요.

---

## 저장 기준 (파일명)

형식: **`Claude-{제목10자}-{YYMMDD}.{확장자}`**

**예시**

- 질문: `파일명 규칙 개선해줘` → `Claude-파일명규칙개선해줘-260525.md`
- 제목 있는 대화: `Claude-API설계논의-260525.txt`


---

## 프로젝트 구조

```
vibe-cc/
└── claude-exporter-mvp/    ← Chrome 확장 프로그램
    ├── manifest.json
    ├── popup.html / popup.js
    ├── content.js
    ├── export-utils.js
    ├── background.js
    ├── export-pdf.html / export-pdf.js
    └── welcome.html
```

---

## 제작 라이선스

임프레스 / soeoda@naver.com
