# CLAUDE.md — MidgardTS 작업 규칙

## 커밋

- `Co-Authored-By` 줄 절대 금지
- 커밋 메시지 형식: `type(scope): 설명`
  - type: `fix` / `feat` / `perf` / `refactor` / `docs` / `test`
  - 예: `fix(auth): resolve loginId2 mismatch on map entry`
- 커밋 단위: 논리적으로 하나의 변경만 포함

## 브랜치

- 작업 브랜치명: `fix/이슈번호-짧은설명` 또는 `feat/짧은설명`
  - 예: `fix/1-loginid2-auth`, `feat/spawn-broadcast`
- main에 직접 push 금지 — 반드시 PR 경유

## 풀 리퀘스트

- PR 제목: 커밋 메시지와 동일한 형식
- PR 본문: 변경 내용 요약 + 테스트 방법
- `Co-Authored-By`, `Generated with` 등 AI 흔적 문구 금지
- 머지 후 작업 브랜치 즉시 삭제

## 이슈

- 제목: `bug: 설명` / `feat: 설명` / `perf: 설명`
- 본문: 재현 방법(버그) 또는 목표 동작(기능) 명시
- 작업 시작 전 이슈 먼저 생성, 완료 후 PR에서 `Closes #번호` 로 연결

## 푸시

- main force push는 히스토리 정정 목적 외 금지
- 작업 브랜치 force push는 리뷰 전이면 허용
