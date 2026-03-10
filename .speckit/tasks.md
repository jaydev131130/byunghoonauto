# Task Breakdown: 문제집 가져오기 - Drag & Drop 전환

## Task 0: Interface Contract 정의 (순차 - 다른 모든 작업의 선행 조건)

### Task 0.1: contracts/extract-upload.ts 생성
- FormData 필드명, Response/Error 타입 정의
- Backend, Frontend 모두 참조할 수 있는 계약
- **선행:** 없음
- **후행:** Task 1.x, Task 2.x 모두

---

## Task 1: Backend 구현 (병렬 가능 ← Task 0 완료 후)

### Task 1.1: config.py + 유틸리티 함수
- `UPLOADS_DIR`, `UPLOADS_STAGING_DIR` 추가
- `sanitize_filename()` 함수 작성
- **독립 실행 가능** (Task 2.x와 병렬)

### Task 1.2: POST /api/extract/upload 엔드포인트
- multipart 수신, 유효성 검증, magic bytes, staging→rename, DB 트랜잭션
- `IntegrityError` → 409 처리
- **의존:** Task 1.1 (config 상수 필요)

### Task 1.3: 기존 POST /api/extract 삭제 + _jobs TTL + 에러 sanitize + asyncio 현대화
- `ExtractionRequest` 삭제
- `_cleanup_job` 추가
- Queue maxsize 설정
- 에러 메시지 sanitize
- `asyncio.get_event_loop()` → `asyncio.create_task()`
- `filepath.stat()` → `len(img_data)`
- **의존:** Task 1.2 (새 엔드포인트가 기존 것을 대체)

### Task 1.4: problem_sets.py 삭제 시 uploads 정리
- delete 엔드포인트에 `shutil.rmtree(UPLOADS_DIR / str(ps_id))` 추가
- **독립 실행 가능** (Task 1.1만 필요)

---

## Task 2: Frontend 구현 (병렬 가능 ← Task 0 완료 후)

### Task 2.1: FileDropZone.tsx 컴포넌트 생성
- Drop zone UI (idle/dragover/preview)
- Drag & Drop + 폴더/파일 선택
- PDF 필터, 파일 목록, 이름 입력
- 접근성
- **독립 실행 가능** (Task 1.x와 병렬)

### Task 2.2: useExtraction.ts 훅 수정
- FormData 전송, uploading 상태, 구조화 에러
- **의존:** Task 0.1 (계약 타입 참조)

### Task 2.3: ImportPage.tsx 수정 + FolderInput.tsx 삭제
- 컴포넌트 교체
- **의존:** Task 2.1, Task 2.2

---

## Task 3: 통합 및 테스트 (순차 ← Task 1, 2 모두 완료 후)

### Task 3.1: 통합 빌드 + E2E 테스트 + QA Loop
- tsc -b, lint
- Dev server 실행, 브라우저 테스트
- 에러 수정 루프
- 스크린샷 캡처

---

## 병렬 실행 매핑 (implement 단계용)

```
[Task 0.1] → 순차 (계약 먼저)
            │
            ├──→ [Backend Agent: Task 1.1 → 1.2 → 1.3 + 1.4]
            │
            └──→ [Frontend Agent: Task 2.1 → 2.2 → 2.3]
            │
            └──→ [통합: Task 3.1] (두 Agent 완료 후)
```

**Backend Agent 범위:** Task 1.1 ~ 1.4 (순차, 한 Agent)
**Frontend Agent 범위:** Task 2.1 ~ 2.3 (순차, 한 Agent)
**두 Agent는 병렬 실행 가능** — Contract (Task 0.1)만 선행 완료되면 됨
