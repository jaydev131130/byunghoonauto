# 오답노트 빌더 - PRD

## 개요

수학 문제집의 틀린 문제를 학생별로 모아 오답노트 PDF를 자동 생성하는 학원/과외 관리 프로그램.

기존에 HWP 매크로 기반으로 수동 운영하던 오답노트 작업을 웹 기반 관리 시스템으로 대체한다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | FastAPI (Python) |
| Frontend | React + TypeScript + Tailwind CSS |
| Database | SQLite (WAL 모드) |
| PDF 생성 | FPDF2 (NanumGothic 한글 폰트) |
| 이미지 추출 | PyMuPDF (fitz) |
| 번들러 | Vite |
| 실행 | uvicorn (로컬 서버, 오프라인 동작) |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────┐
│           Frontend (React SPA)          │
│  Vite build → /frontend/dist            │
├─────────────────────────────────────────┤
│           FastAPI Backend               │
│  - REST API (/api/*)                    │
│  - Static files (/assets, /images)      │
│  - SPA fallback (index.html)            │
├─────────────────────────────────────────┤
│           SQLite Database               │
│  - data/wrong_answer_builder.db         │
├─────────────────────────────────────────┤
│           File System                   │
│  - data/images/ (문제 이미지)            │
│  - data/pdf_output/ (생성된 PDF)         │
└─────────────────────────────────────────┘
```

---

## 핵심 워크플로우

```
PDF 가져오기 → 이미지 추출 → 검증 → 오답노트 생성 → PDF 일괄 출력
```

### 1단계: 문제집 DB화
1. 문제집 폴더 경로 입력 (폴더 내 PDF 파일들)
2. 각 PDF를 단원으로 인식, 이미지 자동 추출
3. `{문제집ID}/{단원ID}/{번호}.jpg` 형태로 저장
4. SSE를 통한 실시간 진행률 표시

### 2단계: 이미지 검증
- 추출된 이미지를 순서대로 확인
- 문제 번호 수정, 순서 변경(DnD), 삭제 가능
- 2-column 레이아웃 기반 (좌상 → 좌하 → 우상 → 우하)
- 추출 수치 표시: `이미지 수/문제 수 (%)`, 단원별 ✓/불일치 표시
- **전체 검증** 버튼: DB ↔ 파일시스템 무결성 비교
- **자동 복구**: 불일치 단원에 "복구" 버튼 → 원본 PDF에서 재추출

### 3단계: 오답노트 생성 (2가지 모드)

> **레이아웃**: 2컬럼 (메인 콘텐츠 + 히스토리 사이드바)

#### 모드 A: 학생 중심 (기본 모드)
```
학생 선택 → 학생별 문제집 선택 → 단원별 오답 입력 → 생성
```
- 학생을 먼저 선택하고 해당 학생에 대해 문제집/오답 입력
- **학생별로 다른 문제집 선택 가능** (예: 학생A는 수학1만, 학생B는 수학1+수학2)
- 학생 탭 전환 시 해당 학생의 문제집 선택과 입력값 유지
- "다른 학생에서 복사" 기능 (문제집 선택 + 오답 입력 모두 복사)
- 적합한 상황: "이 학생이 어떤 문제를 틀렸지?"

#### 모드 B: 문제집 중심
```
문제집 선택(복수) → 학생 선택 → 학생별 오답 입력 → 생성
```
- 문제집을 먼저 선택하고 모든 학생이 동일 문제집에서 오답 입력
- 다중 문제집 지원 (칩 토글 UI)
- 학생별 개별 오답 입력 (학생 탭)
- 적합한 상황: "이 문제집에서 누가 뭘 틀렸지?"

#### 모드 공통 정책
- 모드 전환 시 입력 상태 초기화 (각 모드가 독립 state)
- 동일한 API 사용: `POST /api/wrong-answer-sets/bulk-per-student`
- 생성 완료 후 자동 히스토리 저장

### 생성 히스토리

- 오답노트 생성 시 자동 저장 (non-critical, 실패 시 무시)
- **10일간 보관** (자동 만료 삭제)
- 오른쪽 사이드바에 상시 표시 (HistoryPanel)
- "불러오기" 시 해당 데이터에 맞는 모드로 자동 전환 + 데이터 복원
- Legacy(동일 오답 전체 학생) + per-student(학생별 개별 오답) 포맷 호환
- 다중 문제집 히스토리 지원 (problem_set_ids 배열)

### 4단계: PDF 출력

#### 개별 출력
- 학생 1명의 오답노트 1세트를 PDF로 생성

#### 일괄 출력
- 여러 학생의 오답노트를 하나의 PDF로 합침
- 학생별 구분 간지 페이지 삽입 옵션
- 풀이 공간 비율 조절 (0.5x ~ 2.0x)

#### 일괄 인쇄 페이지 기능
- 오답노트 생성 직후 바로 PDF 생성 가능 (생성 완료 화면에서)
- 일괄 인쇄 페이지에서 최근 생성 오답노트 빠른 선택 (최근 10개)
- URL 파라미터로 사전 선택 (`/batch-print?sets=1,2,3`)
- 학생별 개별 선택 + 오답노트 세트 드롭다운

---

## 페이지 구성

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | 문제집 목록 | 등록된 문제집 리스트, 삭제 |
| `/import` | 문제집 가져오기 | 폴더 경로 입력 → 이미지 추출 |
| `/problem-sets/:id/verify` | 검증 페이지 | 추출된 이미지 순서 확인/수정 |
| `/students` | 학생 관리 | 학생 CRUD |
| `/students/:id/wrong-answers` | 학생별 오답 관리 | 개별 학생 오답노트 관리 |
| `/wrong-answers/create` | 오답노트 생성 | 일괄 생성 → PDF 출력 |
| `/batch-print` | 일괄 인쇄 | 최근 오답노트/학생별 선택 → PDF |

---

## DB 스키마 (8개 테이블)

### problem_sets
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| name | TEXT UNIQUE | 문제집 이름 |
| source_path | TEXT | 원본 폴더 경로 |
| created_at | TEXT | 생성일시 |
| updated_at | TEXT | 수정일시 |

### chapters
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| problem_set_id | INTEGER FK | problem_sets.id |
| name | TEXT | 단원명 |
| source_filename | TEXT | 원본 PDF 파일명 |
| sort_order | INTEGER | 정렬 순서 |
| total_problems | INTEGER | 총 문제 수 |
| created_at | TEXT | 생성일시 |

### problems
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| chapter_id | INTEGER FK | chapters.id |
| number | INTEGER | 문제 번호 |
| image_path | TEXT | 이미지 경로 |
| width | INTEGER | 이미지 너비 |
| height | INTEGER | 이미지 높이 |
| file_size | INTEGER | 파일 크기 |
| page_num | INTEGER | 원본 페이지 번호 |
| column_pos | TEXT | 컬럼 위치 |

### students
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| name | TEXT | 학생 이름 |
| grade | TEXT | 학년 |
| class_name | TEXT | 반 |
| contact | TEXT | 연락처 |
| memo | TEXT | 메모 |
| created_at | TEXT | 생성일시 |

### wrong_answer_sets
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| student_id | INTEGER FK | students.id |
| title | TEXT | 오답노트 제목 |
| created_at | TEXT | 생성일시 |

### wrong_answers
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| wrong_answer_set_id | INTEGER FK | wrong_answer_sets.id |
| chapter_id | INTEGER FK | chapters.id |
| problem_numbers | TEXT (JSON) | 오답 번호 배열 |

### creation_history
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| title | TEXT | 생성 제목 |
| problem_set_id | INTEGER | 대표 문제집 ID |
| data | TEXT (JSON) | 전체 입력 데이터 (student_entries, problem_set_ids 등) |
| created_at | TEXT | 생성일시 (10일 후 자동 삭제) |

### settings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| key | TEXT PK | 설정 키 |
| value | TEXT | 설정 값 |

---

## API 엔드포인트

### 문제집 (Problem Sets)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/problem-sets` | 문제집 목록 |
| GET | `/api/problem-sets/:id` | 문제집 상세 (단원 포함) |
| DELETE | `/api/problem-sets/:id` | 문제집 삭제 |

### 이미지 추출 (Extraction)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/extract` | 추출 시작 |
| GET | `/api/extract/progress/:jobId` | SSE 진행률 |
| POST | `/api/extract/cancel/:jobId` | 추출 취소 |

### 단원/문제 (Chapters & Problems)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/chapters/:id/problems` | 단원별 문제 목록 |
| PUT | `/api/chapters/:id/problems/reorder` | 문제 순서 변경 |
| PUT | `/api/chapters/:id/problems/bulk-shift` | 문제 번호 일괄 이동 |
| PUT | `/api/problems/:id/number` | 개별 문제 번호 변경 |
| DELETE | `/api/problems/:id` | 문제 삭제 |

### 학생 (Students)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/students` | 학생 목록 |
| POST | `/api/students` | 학생 등록 |
| PUT | `/api/students/:id` | 학생 수정 |
| DELETE | `/api/students/:id` | 학생 삭제 |

### 오답노트 (Wrong Answer Sets)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/students/:id/wrong-answer-sets` | 학생별 오답노트 목록 |
| POST | `/api/wrong-answer-sets` | 오답노트 생성 (개별) |
| GET | `/api/wrong-answer-sets/:id` | 오답노트 상세 |
| DELETE | `/api/wrong-answer-sets/:id` | 오답노트 삭제 |
| GET | `/api/wrong-answer-sets/:id/entries` | 오답 항목 조회 |
| PUT | `/api/wrong-answer-sets/:id/entries` | 오답 항목 저장 |
| POST | `/api/wrong-answer-sets/bulk` | 일괄 생성 (동일 오답, 복수 학생) |
| POST | `/api/wrong-answer-sets/bulk-per-student` | 학생별 개별 오답 일괄 생성 |
| GET | `/api/wrong-answer-sets/recent` | 최근 생성 10개 |

### 무결성 검사 (Integrity)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/chapters/:id/health` | 단원 무결성 검사 |
| POST | `/api/chapters/:id/repair` | 단원 자동 복구 (PDF 재추출) |
| GET | `/api/problem-sets/:id/health` | 문제집 전체 무결성 검사 |

### 생성 히스토리 (Creation History)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/creation-history` | 히스토리 목록 (10일간) |
| POST | `/api/creation-history` | 히스토리 저장 |
| GET | `/api/creation-history/:id` | 히스토리 상세 |
| DELETE | `/api/creation-history/:id` | 히스토리 삭제 |

### PDF 생성
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/pdf/generate` | 개별 PDF 생성 |
| POST | `/api/pdf/batch` | 일괄 PDF 생성 |
| GET | `/api/pdf/download/:filename` | PDF 다운로드 |

### 정적 파일
| 경로 | 설명 |
|------|------|
| `/api/images/*` | 문제 이미지 |
| `/assets/*` | 프론트엔드 번들 |
| `/*` | SPA fallback (index.html) |

---

## PDF 레이아웃 규칙

- A4 용지 기준 (210mm x 297mm)
- 2-column 레이아웃
- 배치 순서: 좌상 → 좌하 → 우상 → 우하
- 문제 이미지 사이에 풀이 공간 삽입 (비율 조절 가능)
- 이미지가 페이지/컬럼 경계에서 잘리지 않도록 자동 조절
- 일괄 출력 시 학생별 간지 페이지 삽입 옵션

---

## 아키텍처 결정사항

### 파일 순서 변경(Reorder) 안전성
- **Staging directory 패턴**: .tmp 접미사 대신 임시 디렉토리에 먼저 이동 → 최종 위치로 이동
- **2-pass DB 업데이트**: 음수 임시값(-1, -2, ...) → 양수 최종값 (UNIQUE constraint 회피)
- **완전한 롤백**: `moved_to_final` 리스트로 실패 시 모든 파일 원복
- **Path traversal 보호**: `_safe_path()` 헬퍼로 경로 검증

### DnD(드래그앤드롭) 정책
- **@dnd-kit** 사용 (core + sortable)
- `PointerSensor` (activationConstraint: distance 8px)
- `setActivatorNodeRef`로 드래그 핸들 정확한 등록
- `touch-action: none`으로 브라우저 터치 이벤트 충돌 방지
- **Optimistic state update**: UI 즉시 반영 → API 호출 → 서버 동기화
- **동시 호출 방어**: loading 중 추가 reorder 차단

### 무결성 검사 시스템
- DB 레코드 ↔ 파일시스템 비교 (missing_files, orphan_files 감지)
- 불일치 시 원본 PDF에서 자동 재추출 (repair)
- 검증 페이지에서 시각적 피드백 (✓/빨간 표시)

### 컴포넌트 아키텍처 (오답노트 생성)
```
WrongAnswerCreatePage (오케스트레이터)
├── 모드 탭 (학생 중심 / 문제집 중심)
├── StudentCenteredMode (독립 state)
│   └── 학생 선택 → 학생별 문제집 → 오답 입력 → 생성
├── ProblemSetCenteredMode (독립 state)
│   └── 문제집 선택 → 학생 선택 → 오답 입력 → 생성
├── HistoryPanel (우측 사이드바)
└── Success Phase (PDF 생성/다운로드)
```

### 공유 모듈
- `types/wrong-answer.ts`: 공유 인터페이스 (8개)
- `utils/wrong-answer-helpers.ts`: parseNumbers(), getRelativeDate()

---

## 시스템 요구사항

- 오프라인 동작 (인터넷 불필요)
- macOS, Windows 모두 지원
- 데스크톱 브라우저 기준
- `python main.py` 실행 시 자동 브라우저 오픈 (127.0.0.1:8000)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-09 | v1.0 초기 시스템 (추출 → 검증 → 생성 → PDF) |
| 2026-02-10 | 무결성 검사/자동 복구, 히스토리 기능(10일 보관), 학생별 개별 오답 UX, 다중 문제집 지원, DnD 안전성 강화 |
| 2026-02-11 | 오답노트 생성 모드 분리 (학생 중심/문제집 중심), 히스토리 사이드바 분리, 컴포넌트 아키텍처 리팩토링 |
