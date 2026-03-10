# Implementation Plan: 문제집 가져오기 - Drag & Drop 전환

> **리뷰 반영:** Architect (pdf_path 빌드 순서, FormData 계약, 에러 타입), Performance (chunked IO, executemany, asyncio 현대화)

## Pre-Implementation: Interface Contract 고정 (병렬 작업 전 필수)

### 0.1 API Contract 정의
- `contracts/extract-upload.ts` 생성
- FormData 필드명: `name` (string), `files` (File[])
- Response 타입, Error 타입 (`conflict | validation | server | network`)
- Backend/Frontend 모두 이 계약 참조

## Phase 1: Backend (Frontend 독립 가능)

### 1.1 config.py 업데이트
- `UPLOADS_DIR = DATA_DIR / "uploads"` 추가
- `UPLOADS_STAGING_DIR = UPLOADS_DIR / "_staging"` 추가
- 디렉토리 자동 생성

### 1.2 extraction.py - 새 업로드 엔드포인트
- `POST /api/extract/upload` (multipart/form-data)
- 유효성: 이름(1-100자), 파일 수(≤50), 크기(파일당 100MB, 총 500MB)
- Magic bytes 검증 (`%PDF`) + `await file.seek(0)` 필수
- `sanitize_filename()` 함수 (basename, unicode 정규화, path separator 제거)
- **처리 순서 (Atomic):**
  1. 파일 → staging 저장 (1MB 청크)
  2. DB TRANSACTION: problem_sets + chapters INSERT
  3. COMMIT
  4. staging → `uploads/{ps_id}/` rename
  5. **rename 후** chapter dict에 최종 pdf_path 설정
  6. `asyncio.create_task(_run_extraction(...))`
- `IntegrityError` → 409 + staging cleanup
- 실패 시 staging `shutil.rmtree`

### 1.3 기존 `POST /api/extract` 삭제
- `ExtractionRequest` 모델 삭제
- path traversal 위험 제거

### 1.4 _jobs TTL 정리
- 완료/에러/취소 후 5분 자동 제거
- `asyncio.create_task(_cleanup_job(job_id))`
- Queue maxsize=200

### 1.5 problem_sets.py - 삭제 시 uploads 정리
- `shutil.rmtree(UPLOADS_DIR / str(ps_id))` 추가

### 1.6 에러 메시지 Sanitize
- `_run_extraction` 예외: `logger.exception()` + SSE에 일반 메시지
- `asyncio.get_event_loop()` → `asyncio.create_task()` / `asyncio.get_running_loop()` 교체

### 1.7 성능 개선 (스코프 내)
- `filepath.stat()` → `len(img_data)` (extractor.py)

## Phase 2: Frontend (Backend 독립 가능)

### 2.1 FileDropZone.tsx 신규 생성
- Drop zone UI (idle / dragover / preview)
- Drag & Drop: `webkitGetAsEntry` → 1depth 스캔
- 폴더 선택: `webkitdirectory`
- 파일 선택: `multiple accept=.pdf`
- PDF 필터 + 제외 안내
- 파일 목록: `max-h-64 overflow-y-auto`, truncate + tooltip
- 문제집 이름: 자동추출/편집, maxLength 100, 글자수 카운터
- 중복 파일명 (1), (2) 접미사
- 접근성: tabIndex, aria-label, aria-live, role=button
- ESC 핸들러

### 2.2 useExtraction.ts 훅 수정
- `startExtraction(files: File[], problemSetName: string)`
- FormData: `name`, `files` (contract 참조)
- `uploading` 상태 추가
- 구조화된 에러: `{ type: 'conflict'|'validation'|'server'|'network', message: string }`
- 409 → `conflict` 타입 → FileDropZone이 PREVIEW 복귀 + 이름 포커스
- SSE 끊김: problemSetId 있으면 목록 안내
- `asyncio` → fetch abort controller

### 2.3 ImportPage.tsx 수정
- `FolderInput` → `FileDropZone` 교체

### 2.4 FolderInput.tsx 삭제

## Phase 3: 통합 및 테스트

### 3.1 빌드 확인
- `tsc -b` + `npm run lint`

### 3.2 E2E 테스트
- 파일 선택 → 미리보기 → 가져오기 → 추출 완료
- 에러 케이스: 빈 폴더, 비PDF, 중복 이름

### 3.3 QA Loop
- Dev server 모니터링
- 브라우저 콘솔 에러 체크
- 스크린샷 캡처

## 의존성 그래프

```
Step 0.1 (Contract) ──┐
                      ├──→ Phase 1 (Backend)  ───┐
                      └──→ Phase 2 (Frontend) ───┼──→ Phase 3 (통합)
                                                 │
Contract 고정 후 Phase 1, 2 병렬 실행 가능 ──────┘
```

## 리스크

| 리스크 | 완화 |
|--------|------|
| webkitGetAsEntry 호환성 | Chrome/Edge 타겟, Safari fallback |
| 대용량 PDF 메모리 | 1MB 청크 + 100MB 제한 |
| DB-파일 원자성 | Staging → rename 패턴 |
| pdf_path 빌드 타이밍 | rename 완료 후 최종 경로로 dict 구성 |
| 409 에러 UX | 구조화 에러 타입으로 PREVIEW 복귀 |
