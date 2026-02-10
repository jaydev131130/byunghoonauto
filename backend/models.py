from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Problem Sets
# ---------------------------------------------------------------------------

class ProblemSetCreate(BaseModel):
    name: str
    source_path: str


class ChapterResponse(BaseModel):
    id: int
    problem_set_id: int
    name: str
    source_filename: str
    sort_order: int
    total_problems: int
    created_at: str

    model_config = {"from_attributes": True}


class ProblemResponse(BaseModel):
    id: int
    chapter_id: int
    number: int
    image_path: str
    width: int
    height: int
    file_size: int
    page_num: int | None = None
    column_pos: str | None = None

    model_config = {"from_attributes": True}


class ProblemSetResponse(BaseModel):
    id: int
    name: str
    source_path: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ProblemSetDetail(ProblemSetResponse):
    chapters: list[ChapterResponse] = []


# ---------------------------------------------------------------------------
# Problem operations
# ---------------------------------------------------------------------------

class ProblemReorder(BaseModel):
    problem_id: int
    new_number: int


class ProblemBulkShift(BaseModel):
    chapter_id: int
    from_number: int
    shift: int = Field(description="Positive to shift up, negative to shift down")


class ProblemNumberUpdate(BaseModel):
    problem_id: int
    new_number: int


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

class StudentCreate(BaseModel):
    name: str
    grade: str | None = None
    class_name: str | None = None
    contact: str | None = None
    memo: str | None = None


class StudentUpdate(BaseModel):
    name: str | None = None
    grade: str | None = None
    class_name: str | None = None
    contact: str | None = None
    memo: str | None = None


class StudentResponse(BaseModel):
    id: int
    name: str
    grade: str | None = None
    class_name: str | None = None
    contact: str | None = None
    memo: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Wrong Answers
# ---------------------------------------------------------------------------

class WrongAnswerEntry(BaseModel):
    chapter_id: int
    chapter_name: str = ""
    problem_numbers: list[int]


class WrongAnswerEntrySave(BaseModel):
    chapter_id: int
    problem_numbers: list[int]


class WrongAnswerSetCreate(BaseModel):
    student_id: int
    title: str | None = None
    entries: list[WrongAnswerEntrySave] = []


class WrongAnswerSetResponse(BaseModel):
    id: int
    student_id: int
    title: str | None = None
    created_at: str
    entries: list[WrongAnswerEntry] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

class ExtractRequest(BaseModel):
    problem_set_name: str
    pdf_paths: list[str]


class ExtractProgress(BaseModel):
    status: str
    current_file: str = ""
    current_page: int = 0
    total_pages: int = 0
    problems_found: int = 0
    message: str = ""


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------

class PdfGenerateRequest(BaseModel):
    wrong_answer_set_id: int
    spacer_ratio: float = Field(default=1.0, ge=0.0, le=3.0)


class PdfBatchRequest(BaseModel):
    wrong_answer_set_ids: list[int]
    spacer_ratio: float = Field(default=1.0, ge=0.0, le=3.0)
    include_dividers: bool = True


class PdfResponse(BaseModel):
    filename: str
    download_url: str


# ---------------------------------------------------------------------------
# Wrong Answer Entry (for router-level operations)
# ---------------------------------------------------------------------------

class WrongAnswerEntryInput(BaseModel):
    chapter_id: int
    problem_numbers: list[int]


class WrongAnswerEntrySaveRequest(BaseModel):
    entries: list[WrongAnswerEntryInput]


class WrongAnswerEntryResponse(BaseModel):
    id: int
    chapter_id: int
    chapter_name: str
    problem_set_name: str
    problem_numbers: list[int]


class BulkWrongAnswerSetCreate(BaseModel):
    student_ids: list[int]
    title: str | None = None
    entries: list[WrongAnswerEntryInput]


class StudentWrongAnswerInput(BaseModel):
    student_id: int
    entries: list[WrongAnswerEntryInput]


class BulkPerStudentCreate(BaseModel):
    title: str = ""
    student_entries: list[StudentWrongAnswerInput] = Field(min_length=1)
