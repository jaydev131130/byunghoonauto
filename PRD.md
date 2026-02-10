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
| PDF 생성 | ReportLab |
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
- 문제 번호 수정, 순서 변경, 삭제 가능
- 2-column 레이아웃 기반 (좌상 → 좌하 → 우상 → 우하)

### 3단계: 오답노트 생성 (2가지 방식)

#### 방식 A: 학생 중심 (개별)
- 학생 관리 → 학생 선택 → 오답 입력
- 학생별로 문제집/단원/번호를 개별 지정

#### 방식 B: 오답노트 중심 (일괄 생성)
- 오답노트 생성 페이지에서 문제집 선택
- 단원별 오답 번호 입력
- 학생 복수 선택 → 일괄 생성
- 생성 직후 바로 PDF 출력 가능

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

## DB 스키마 (7개 테이블)

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
| POST | `/api/wrong-answer-sets/bulk` | 일괄 생성 (복수 학생) |
| GET | `/api/wrong-answer-sets/recent` | 최근 생성 10개 |

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

## 시스템 요구사항

- 오프라인 동작 (인터넷 불필요)
- macOS, Windows 모두 지원
- 데스크톱 브라우저 기준
- `python main.py` 실행 시 자동 브라우저 오픈 (127.0.0.1:8000)
