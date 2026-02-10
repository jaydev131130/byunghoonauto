# 오답노트 빌더 (Wrong Answer Builder)

수학 학원 선생님을 위한 **학생 오답노트 자동 생성 시스템**입니다.

PDF 문제집에서 문제 이미지를 자동 추출하고, 학생별 오답 번호를 입력하면 풀이 공간이 포함된 오답노트 PDF를 자동으로 생성합니다.

## 프로젝트 소개

### 핵심 워크플로우

```
PDF 문제집 임포트 → 문제 이미지 자동 추출 → 학생 등록 → 오답 번호 입력 → 오답노트 PDF 생성
```

### 주요 기능

- **PDF 문제 추출**: PDF 파일에서 문제 이미지를 자동 추출 (2단 레이아웃 인식, 좌→우 정렬)
- **검증 화면**: 추출된 이미지의 번호/순서를 드래그앤드롭으로 수정 가능
- **학생 관리**: 학생 정보 등록 및 관리
- **오답노트 생성**: 학생별 오답 번호를 선택하면 해당 문제만 모은 PDF 자동 생성
- **일괄 인쇄**: 여러 학생의 오답노트를 하나의 PDF로 합쳐서 출력 (학생별 구분 페이지 포함)
- **풀이 공간 조절**: 문제 아래 풀이 공간 비율 조절 가능 (0~3배)

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Backend** | FastAPI (Python), SQLite, PyMuPDF (fitz), FPDF2 |
| **Frontend** | React 19 + TypeScript + Vite 7 + Tailwind CSS 4 |
| **상태 관리** | Zustand |
| **드래그앤드롭** | @dnd-kit/core, @dnd-kit/sortable |
| **라우팅** | React Router DOM v7 |
| **Validation** | Zod (프론트), Pydantic (백엔드) |
| **실시간 진행률** | SSE (Server-Sent Events) |

## 설치 방법

### 요구 사항

- Python 3.10 이상
- Node.js 18 이상

### 설치 단계

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd byunghoon

# 2. Python 의존성 설치 (둘 중 하나 선택)
pip install -e .
# 또는
pip install -r requirements.txt

# 3. 프론트엔드 빌드
cd frontend
npm install
npm run build
cd ..

# 4. 실행
python main.py
```

서버가 시작되면 **http://localhost:8000** 이 자동으로 브라우저에서 열립니다.

### 개발 모드 실행

프론트엔드를 수정하며 개발할 때는 백엔드와 프론트엔드를 별도로 실행합니다.

```bash
# 터미널 1: 백엔드 (자동 리로드 포함)
python main.py

# 터미널 2: 프론트엔드 dev server (HMR 지원)
cd frontend
npm run dev
```

프론트엔드 dev server는 `/api` 요청을 `localhost:8000`으로 프록시합니다.

## 데이터 저장 위치

모든 데이터는 프로젝트 루트의 `data/` 폴더에 저장됩니다.

```
data/
├── app.db              <- SQLite 데이터베이스 (문제집, 학생, 오답 등 모든 메타데이터)
├── images/             <- 추출된 문제 이미지
│   └── {문제집ID}/
│       └── {단원ID}/
│           ├── 001.jpg
│           ├── 002.jpg
│           └── ...
└── pdf_output/         <- 생성된 오답노트 PDF
```

- `data/` 폴더는 프로그램 첫 실행 시 **자동 생성**됩니다.
- **백업**: `data/` 폴더 전체를 복사하면 모든 데이터가 백업됩니다.
- **초기화**: `data/` 폴더를 삭제하면 모든 데이터가 초기화됩니다.

## 사용 방법

### 1. PDF 문제집 가져오기

사이드바에서 **"문제집 가져오기"** 를 클릭합니다. PDF 파일이 있는 폴더 경로를 입력하면, 해당 폴더 내 모든 PDF 파일을 단원별로 자동 추출합니다. 추출 진행률은 실시간(SSE)으로 표시됩니다.

### 2. 추출 결과 검증

**"문제집 관리"** 에서 문제집을 선택하면 검증 화면으로 이동합니다. 추출된 이미지의 문제 번호가 올바른지 확인하고, 필요시 번호를 수정하거나 드래그앤드롭으로 순서를 변경할 수 있습니다. 일괄 번호 시프트 기능도 지원합니다.

### 3. 학생 등록

**"학생 관리"** 에서 학생 이름, 학년, 반, 연락처, 메모 등을 등록합니다.

### 4. 오답노트 생성

**"오답노트 생성"** 에서 학생을 선택하고, 문제집과 단원을 고른 뒤 틀린 문제 번호를 입력합니다. 여러 단원의 오답을 한 번에 등록할 수 있습니다.

### 5. PDF 일괄 인쇄

**"일괄 인쇄"** 에서 여러 학생의 오답노트를 선택하여 하나의 PDF로 합칠 수 있습니다. 학생 간 구분 페이지를 포함할 수 있으며, 풀이 공간 비율도 조절 가능합니다. 생성된 PDF는 A4 2단 레이아웃으로 출력됩니다.

## 프로젝트 구조

```
byunghoon/
├── main.py                          # FastAPI 앱 진입점 + SPA 라우팅
├── pyproject.toml                   # Python 패키지 설정
├── requirements.txt                 # Python 의존성
│
├── backend/
│   ├── config.py                    # 경로 설정 (DATA_DIR, IMAGES_DIR 등)
│   ├── database.py                  # SQLite 초기화 + 스키마 정의
│   ├── models.py                    # Pydantic 모델 (요청/응답 스키마)
│   ├── routers/
│   │   ├── extraction.py            # PDF 추출 API (SSE 진행률)
│   │   ├── problem_sets.py          # 문제집 CRUD
│   │   ├── chapters.py              # 단원 CRUD
│   │   ├── problems.py              # 문제 CRUD + 번호 수정/재정렬
│   │   ├── students.py              # 학생 CRUD
│   │   ├── wrong_answers.py         # 오답 세트 CRUD
│   │   └── pdf_generate.py          # PDF 생성/다운로드 API
│   ├── services/
│   │   ├── extractor.py             # PDF → 이미지 추출 엔진 (PyMuPDF)
│   │   ├── image_store.py           # 이미지 파일 저장 관리
│   │   └── pdf_generator.py         # 오답노트 PDF 생성 엔진 (FPDF2)
│   └── utils/
│       └── paths.py                 # 경로 유틸리티
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # 라우트 정의
│   │   ├── main.tsx                 # React 진입점
│   │   ├── pages/
│   │   │   ├── ProblemSetListPage.tsx   # 문제집 목록
│   │   │   ├── ImportPage.tsx           # PDF 가져오기
│   │   │   ├── VerificationPage.tsx     # 추출 결과 검증
│   │   │   ├── StudentListPage.tsx      # 학생 관리
│   │   │   ├── WrongAnswerPage.tsx      # 학생별 오답 목록
│   │   │   ├── WrongAnswerCreatePage.tsx # 오답 등록
│   │   │   └── BatchPrintPage.tsx       # 일괄 인쇄
│   │   ├── components/
│   │   │   ├── common/              # Button, Modal, ConfirmDialog
│   │   │   ├── layout/              # Sidebar, MainLayout
│   │   │   ├── problem-set/         # FolderInput, ExtractionProgress, ProblemSetCard
│   │   │   ├── student/             # StudentForm, StudentCard
│   │   │   ├── verification/        # ImageCard, ImageGrid, NumberEditor, BulkShiftModal
│   │   │   └── wrong-answer/        # ProblemSetPicker, ChapterPicker, NumberInput, WrongAnswerList
│   │   ├── hooks/                   # useExtraction, useProblems, useProblemSets, useStudents, useWrongAnswers
│   │   ├── stores/                  # Zustand stores (problemSet, extraction, student)
│   │   ├── lib/                     # API 클라이언트, 상수
│   │   └── types/                   # TypeScript 타입 정의
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── data/                            # 런타임 데이터 (자동 생성, .gitignore)
│   ├── app.db
│   ├── images/
│   └── pdf_output/
│
└── samples/                         # 샘플 PDF 파일
```

## API 문서

FastAPI가 자동 생성하는 API 문서를 사용할 수 있습니다.

| 문서 | URL |
|------|-----|
| **Swagger UI** | http://localhost:8000/docs |
| **ReDoc** | http://localhost:8000/redoc |

### 주요 API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/extract` | PDF 추출 시작 (SSE 스트림) |
| GET | `/api/problem-sets` | 문제집 목록 조회 |
| GET | `/api/problem-sets/{id}` | 문제집 상세 (단원 포함) |
| GET | `/api/chapters/{id}/problems` | 단원별 문제 목록 |
| PATCH | `/api/problems/{id}/number` | 문제 번호 수정 |
| GET | `/api/students` | 학생 목록 조회 |
| POST | `/api/students` | 학생 등록 |
| POST | `/api/wrong-answer-sets` | 오답 세트 생성 |
| POST | `/api/pdf/generate` | 오답노트 PDF 생성 |
| POST | `/api/pdf/batch` | 일괄 PDF 생성 |

## 한글 폰트 안내

PDF에 한글이 포함되므로, 시스템에 한글 폰트가 설치되어 있어야 합니다.

- **macOS**: AppleSDGothicNeo 또는 NanumGothic (기본 설치)
- **Windows**: 맑은 고딕 또는 NanumGothic (기본 설치)
- **Linux**: NanumGothic 설치 필요
  ```bash
  sudo apt install fonts-nanum
  ```

## 라이선스

이 프로젝트는 비공개 프로젝트입니다.
