# Spec: 문제집 가져오기 - Drag & Drop / 폴더선택 전환

## 1. 개요

기존 텍스트 경로 입력 방식(`FolderInput.tsx`)을 **Drag & Drop + 폴더선택 + 파일선택** UI로 완전 교체한다.
백엔드는 파일시스템 경로 대신 **multipart file upload**를 수신하여 처리한다.

## 2. 확정된 요구사항

| 항목 | 결정 |
|------|------|
| 문제집 이름 | 폴더 선택 시 폴더명 자동 사용. 개별 파일 드래그 시 이름 입력 필드 표시 |
| 업로드 방식 | Drag&Drop + 폴더선택(`webkitdirectory`) + 파일선택(`multiple accept=.pdf`) |
| 업로드 제한 | 서버: 파일당 100MB, 총 500MB, 최대 50파일 (로컬 앱이지만 실수 방지) |
| 기존 경로 입력 | 완전 제거 |
| 업로드 흐름 | 2단계: 미리보기(파일 목록 + 문제집명) → '가져오기' 버튼 → 추출 시작 |
| 비PDF 파일 | 프론트에서 자동 필터 + "N개 파일 제외됨" 안내 |

## 3. 사용자 흐름 (User Flow)

```
[Drop Zone 영역]
  ☁️ "PDF 파일 또는 폴더를 여기에 드래그하세요"
  [폴더 선택]  [파일 선택]
        │
        ▼
[미리보기 상태]
  문제집 이름: [쎈B 1-1        ] ← 폴더명 자동 입력 / 편집 가능 (max 100자)
  ─────────────────────────
  📄 1단원_집합.pdf (2.3MB)       ← max-h-64 스크롤 영역
  📄 2단원_명제.pdf (1.8MB)
  📄 3단원_함수.pdf (3.1MB)
  ─────────────────────────
  ⚠️ 2개 파일 제외됨 (.docx, .hwp)    ← 비PDF 있을 때만 표시
  [가져오기]  [취소]
        │
        ▼
[업로드 중 - "파일 업로드 중..." 스피너]
        │
        ▼
[추출 진행 - 기존 ExtractionProgress 재사용 + indeterminate bar until first chapter]
```

### 3.1 Drop Zone 상태 머신

```
IDLE → (드래그 진입) → DRAG_OVER → (드래그 이탈 / ESC) → IDLE
DRAG_OVER → (드롭) → PREVIEW  (PDF 0개면 에러 표시 후 IDLE)
IDLE → (버튼 클릭 → 파일/폴더 선택) → PREVIEW
PREVIEW → (취소) → IDLE
PREVIEW → (가져오기) → UPLOADING → (응답 수신) → EXTRACTING
UPLOADING → (에러) → PREVIEW (409: 이름 입력에 포커스)
```

### 3.2 파일 선택 방식별 동작

| 방식 | 문제집 이름 | 챕터 구성 |
|------|------------|----------|
| 폴더 선택 (webkitdirectory) | `webkitRelativePath`에서 루트 폴더명 추출 | 각 PDF가 하나의 챕터 |
| 폴더 드래그 & 드롭 | `DataTransferItem.webkitGetAsEntry()` → 폴더명 (1depth만, 하위폴더 무시 + 안내) | 각 PDF가 하나의 챕터 |
| 개별 파일 선택/드래그 | 사용자 입력 (필수) | 각 PDF가 하나의 챕터 |

## 4. 프론트엔드 변경

### 4.1 삭제 대상
- `frontend/src/components/problem-set/FolderInput.tsx` → 삭제

### 4.2 신규/수정 파일
- `frontend/src/components/problem-set/FileDropZone.tsx` — 새 컴포넌트
- `frontend/src/hooks/useExtraction.ts` — `FormData` 전송 + `uploading` 상태 추가
- `frontend/src/pages/ImportPage.tsx` — `FolderInput` → `FileDropZone` 교체

### 4.3 FileDropZone 컴포넌트 명세

**Props:**
```typescript
interface FileDropZoneProps {
  onSubmit: (files: File[], problemSetName: string) => void
  disabled?: boolean
}
```

**내부 상태:**
```typescript
type DropZoneState = 'idle' | 'dragover' | 'preview'

interface PreviewState {
  files: File[]              // PDF만 필터링된 목록
  excludedCount: number      // 제외된 비PDF 파일 수
  problemSetName: string     // 자동 추출 또는 사용자 입력
  nameAutoDetected: boolean  // 폴더명에서 자동 추출 여부
}
```

**UI 요구사항:**
- Drop zone: `border-dashed`, 드래그 오버 시 `border-blue-500 bg-blue-50 scale-[1.01]` + 텍스트 "여기에 놓으세요"
- 아이콘: IDLE 상태에서 업로드 클라우드 아이콘 표시
- test-id: `file-drop-zone`, `folder-select-btn`, `file-select-btn`, `problem-set-name-input`, `import-button`, `cancel-button`
- 파일 목록: `max-h-64 overflow-y-auto`, 파일명 `truncate` + title tooltip + 크기 표시
- 파일명 정렬: 알파벳순
- 이름 입력: `maxLength={100}` + 글자수 카운터 (90자 이상 빨간색)
- 중복 파일명: PREVIEW에서 (1), (2) 접미사 표시
- 하위폴더: 폴더 드롭 시 1depth만 스캔, 하위폴더 존재 시 "하위 폴더의 파일은 포함되지 않습니다" 안내

**접근성:**
- Drop zone: `tabIndex={0}`, `role="button"`, `Enter/Space` → 파일 선택 트리거
- `aria-label="PDF 파일 또는 폴더를 드래그하거나 Enter 키를 눌러 선택하세요"`
- `aria-live="polite"` 영역: 상태 변경 시 스크린 리더 알림
- 상태 아이콘: 색상 외 텍스트 접두사 ("✓ 완료", "✗ 오류", "— 취소")
- progress bar: `role="progressbar"` + `aria-valuenow/min/max`

### 4.4 useExtraction 훅 변경

```typescript
// Before
startExtraction(folderPath: string): void

// After
startExtraction(files: File[], problemSetName: string): void
```

**변경 사항:**
- 새 상태: `'uploading'` 추가 (idle → uploading → extracting → done/error)
- `fetch` body: `FormData` (files + name)
- Content-Type: 자동 (multipart/form-data)
- 에러 응답 처리: 409 → PREVIEW로 복귀 + 이름 필드 포커스
- SSE 연결 끊김: `problemSetId`가 있으면 "문제집 목록에서 확인해보세요" 안내
- 나머지 SSE 진행상황 로직은 동일

## 5. 백엔드 변경

### 5.1 수정 파일
- `backend/routers/extraction.py` — 엔드포인트 변경
- `backend/config.py` — `UPLOADS_DIR` 추가
- `backend/routers/problem_sets.py` — 삭제 시 uploads 디렉토리도 정리

### 5.2 새 엔드포인트

```
POST /api/extract/upload
Content-Type: multipart/form-data

Body:
  - name: string (문제집 이름, 1-100자)
  - files: File[] (PDF 파일 리스트, 최대 50개)

Response: 200 OK
{
  "job_id": "uuid",
  "problem_set_id": 1
}

Errors:
  - 400: "PDF 파일이 없습니다."
  - 400: "문제집 이름이 비어있습니다."
  - 400: "파일이 너무 큽니다: {filename}"
  - 400: "최대 50개 파일까지 업로드 가능합니다."
  - 409: "이미 존재하는 문제집 이름입니다."
```

### 5.3 백엔드 처리 흐름 (Atomic)

```
1. 파일 수신 (UploadFile[])
2. 유효성 검증:
   a. 이름: 1-100자, strip
   b. 파일 수: ≤ 50
   c. 각 파일: magic bytes (%PDF) 확인 + 100MB 이하
   d. 총 크기: ≤ 500MB
3. 파일명 Sanitize (path traversal 방지: basename만, unicode 정규화)
4. Staging 디렉토리 생성: data/uploads/_staging/{uuid}/
5. PDF 파일 저장 (1MB 청크, 명시적 close)
6. BEGIN DB TRANSACTION
   a. problem_sets INSERT → ps_id 획득 (IntegrityError → 409)
   b. chapters INSERT (각 PDF = 1 챕터)
7. COMMIT
8. Staging → data/uploads/{ps_id}/ 로 rename (atomic)
9. 백그라운드 extraction 태스크 실행
10. {job_id, problem_set_id} 반환

ON FAILURE (any step):
  - ROLLBACK DB
  - shutil.rmtree(staging_dir)
  - 에러 로그는 서버 측, 클라이언트에는 일반 메시지만 반환
```

### 5.4 기존 엔드포인트 (`POST /api/extract`)

**삭제한다.** 기존 path traversal 위험 제거.

### 5.5 보안 요구사항

| 요구사항 | 구현 |
|----------|------|
| 파일 검증 | Magic bytes (`%PDF`) 서버 측 확인 |
| 파일 크기 | 파일당 100MB, 총 500MB |
| 파일 수 | 업로드당 최대 50개 |
| 파일명 Sanitize | basename 추출, unicode 정규화, path separator 제거, .pdf 확장자 강제 |
| 업로드 정리 | 문제집 삭제 시 `data/uploads/{ps_id}/` 함께 삭제 |
| 에러 메시지 | 서버 로그에 상세, 클라이언트에는 일반 메시지 |
| 이름 검증 | 서버: 1-100자, trimmed |
| 임시 파일 정리 | 실패 시 staging 디렉토리 삭제 |

### 5.6 _jobs 메모리 관리

- 완료/에러/취소된 job은 5분 후 자동 제거 (TTL)
- `asyncio.sleep(300)` → `_jobs.pop(job_id)`

## 6. 데이터 모델 변경

### 6.1 DB 스키마: 변경 없음
- `problem_sets.source_path` → 업로드 디렉토리 경로 저장 (기존과 동일 용도)
- `chapters`, `problems` 테이블 변경 없음

### 6.2 파일 저장 구조
```
data/
├── images/          # 기존: 추출된 문제 이미지
│   └── {ps_id}/{ch_id}/001.jpg
└── uploads/         # 신규: 업로드된 PDF 원본
    ├── _staging/    # 업로드 중 임시 저장
    │   └── {uuid}/
    └── {ps_id}/     # 확정된 업로드
        ├── 1단원_집합.pdf
        └── 2단원_명제.pdf
```

## 7. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 빈 폴더 드래그 (PDF 0개) | Drop zone 내 인라인 에러 표시, IDLE 유지 |
| PDF + 비PDF 혼합 폴더 | PDF만 표시, "N개 파일 제외됨" 안내 |
| 비PDF만 있는 폴더 | Drop zone 내 인라인 에러 "PDF 파일이 없습니다" |
| 중복 문제집 이름 | 409 → PREVIEW로 복귀, 이름 입력에 포커스 + 빨간 테두리 |
| 동일 파일명 PDF 여러 개 | PREVIEW에서 (1), (2) 접미사 표시, 서버에도 동일 적용 |
| 매우 긴 폴더명 | 문제집 이름 input `maxLength=100` + 글자수 카운터 |
| 드래그 중 ESC | `keydown` 리스너로 IDLE 복귀 |
| 추출 중 페이지 이탈 | 기존 동작 유지 (백엔드 계속 처리) |
| 50+ 파일 목록 | `max-h-64 overflow-y-auto` 스크롤 |
| 긴 파일명 | `truncate` + title tooltip |
| 하위 폴더 포함 드롭 | 1depth만 스캔, "하위 폴더의 파일은 포함되지 않습니다" 안내 |
| SSE 연결 끊김 | problemSetId 있으면 목록 페이지 안내, 없으면 재시도 |

## 8. 비기능 요구사항

- **성능**: 파일 업로드는 localhost → 네트워크 지연 무시. 대용량 시 indeterminate progress bar
- **접근성**: keyboard focus, aria-live, role=progressbar, 색상 외 텍스트 구분
- **보안**: Section 5.5 참조
- **정리**: 문제집 삭제 시 `data/uploads/{ps_id}/` + `data/images/{ps_id}/` 모두 삭제
