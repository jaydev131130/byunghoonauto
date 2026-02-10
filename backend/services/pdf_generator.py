"""PDF generation engine for wrong-answer notebooks.

Layout: A4 (210x297mm), 2-column, left-to-right fill order.
Margins: top=14mm, bottom=14mm, left=10.5mm, right=10.5mm.
Column gap: 5.6mm.
Column width: (210 - 10.5 - 10.5 - 5.6) / 2 = 91.7mm.
"""

from __future__ import annotations

import json
import logging
import platform
import uuid
from pathlib import Path

from fpdf import FPDF

from backend.config import IMAGES_DIR, PDF_OUTPUT_DIR
from backend.database import get_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Layout constants (mm)
# ---------------------------------------------------------------------------
PAGE_W = 210.0
PAGE_H = 297.0
MARGIN_TOP = 14.0
MARGIN_BOTTOM = 14.0
MARGIN_LEFT = 10.5
MARGIN_RIGHT = 10.5
COLUMN_GAP = 5.6
COLUMN_WIDTH = (PAGE_W - MARGIN_LEFT - MARGIN_RIGHT - COLUMN_GAP) / 2  # ~91.7mm

HEADER_HEIGHT = 10.0  # mm reserved for page header text
HEADER_FONT_SIZE = 9
PROBLEM_LABEL_HEIGHT = 5.0  # mm for "N번" label above each image
PROBLEM_LABEL_FONT_SIZE = 8
DIVIDER_FONT_SIZE = 28

USABLE_HEIGHT = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM  # ~269mm


# ---------------------------------------------------------------------------
# Korean font discovery
# ---------------------------------------------------------------------------
def _find_korean_font() -> str | None:
    """Find a Korean font file on the system."""
    candidates: list[str] = []

    if platform.system() == "Darwin":
        candidates = [
            str(Path.home() / "Library/Fonts/NanumGothic.ttf"),
            "/Library/Fonts/NanumGothic.ttf",
            "/System/Library/Fonts/AppleSDGothicNeo.ttc",
            "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
        ]
    elif platform.system() == "Windows":
        candidates = [
            "C:/Windows/Fonts/NanumGothic.ttf",
            "C:/Windows/Fonts/malgun.ttf",
        ]
    else:
        candidates = [
            "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
            "/usr/share/fonts/nanum/NanumGothic.ttf",
        ]

    for path in candidates:
        if Path(path).exists():
            return path
    return None


# ---------------------------------------------------------------------------
# PDF builder helper
# ---------------------------------------------------------------------------
class _WrongAnswerPDF(FPDF):
    """Thin wrapper around FPDF to manage Korean font and 2-column layout."""

    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=False)
        self._korean_ready = False
        self._setup_font()

    def _setup_font(self) -> None:
        font_path = _find_korean_font()
        if font_path:
            try:
                self.add_font("Korean", "", font_path)
                self.add_font("Korean", "B", font_path)
                self._korean_ready = True
                logger.debug("Korean font loaded from %s", font_path)
            except Exception:
                logger.warning(
                    "Failed to load Korean font from %s, falling back to Helvetica",
                    font_path,
                    exc_info=True,
                )
        if not self._korean_ready:
            logger.info("No Korean font found, using Helvetica (Korean text may not render)")

    def _set_font(self, size: float, bold: bool = False) -> None:
        if self._korean_ready:
            self.set_font("Korean", "B" if bold else "", size)
        else:
            self.set_font("Helvetica", "B" if bold else "", size)


# ---------------------------------------------------------------------------
# Data fetching helpers
# ---------------------------------------------------------------------------
def _fetch_set_data(wrong_answer_set_id: int) -> dict:
    """Fetch all needed data for a single wrong answer set.

    Returns dict with keys:
        student_name, set_title, items: list of {
            problem_set_name, chapter_name, chapter_id,
            problem_set_id, number, image_path, width, height
        }
    """
    with get_db() as db:
        ws_row = db.execute(
            "SELECT ws.id, ws.title, s.name AS student_name "
            "FROM wrong_answer_sets ws "
            "JOIN students s ON s.id = ws.student_id "
            "WHERE ws.id = ?",
            (wrong_answer_set_id,),
        ).fetchone()
        if not ws_row:
            raise ValueError(f"Wrong answer set {wrong_answer_set_id} not found")

        entry_rows = db.execute(
            "SELECT wa.chapter_id, wa.problem_numbers, "
            "c.name AS chapter_name, c.problem_set_id, "
            "ps.name AS problem_set_name "
            "FROM wrong_answers wa "
            "JOIN chapters c ON c.id = wa.chapter_id "
            "JOIN problem_sets ps ON ps.id = c.problem_set_id "
            "WHERE wa.wrong_answer_set_id = ? "
            "ORDER BY ps.name, c.name",
            (wrong_answer_set_id,),
        ).fetchall()

        items: list[dict] = []
        for entry in entry_rows:
            numbers = json.loads(entry["problem_numbers"])
            for num in sorted(numbers):
                problem = db.execute(
                    "SELECT image_path, width, height "
                    "FROM problems "
                    "WHERE chapter_id = ? AND number = ?",
                    (entry["chapter_id"], num),
                ).fetchone()
                if not problem:
                    logger.warning(
                        "Problem ch=%d num=%d not found, skipping",
                        entry["chapter_id"],
                        num,
                    )
                    continue
                items.append(
                    {
                        "problem_set_name": entry["problem_set_name"],
                        "chapter_name": entry["chapter_name"],
                        "chapter_id": entry["chapter_id"],
                        "problem_set_id": entry["problem_set_id"],
                        "number": num,
                        "image_path": str(IMAGES_DIR / problem["image_path"]),
                        "width": problem["width"],
                        "height": problem["height"],
                    }
                )

    return {
        "student_name": ws_row["student_name"],
        "set_title": ws_row["title"] or "",
        "items": items,
    }


# ---------------------------------------------------------------------------
# Layout engine
# ---------------------------------------------------------------------------
def _layout_items(
    pdf: _WrongAnswerPDF,
    items: list[dict],
    spacer_ratio: float,
    header_text_prefix: str,
) -> None:
    """Place problem images in 2-column layout across pages.

    Each item gets:
    1. A problem label ("N번") above the image
    2. The image scaled to column width
    3. A spacer below equal to image_height * spacer_ratio
    """
    if not items:
        return

    col = 0  # 0 = left, 1 = right
    y_pos = [0.0, 0.0]  # current y position per column

    current_header = ""

    def _col_x(c: int) -> float:
        if c == 0:
            return MARGIN_LEFT
        return MARGIN_LEFT + COLUMN_WIDTH + COLUMN_GAP

    def _start_new_page(header: str) -> None:
        nonlocal col, y_pos
        pdf.add_page()
        col = 0
        y_pos = [MARGIN_TOP, MARGIN_TOP]
        _draw_header(header)

    def _draw_header(header: str) -> None:
        nonlocal y_pos
        pdf._set_font(HEADER_FONT_SIZE, bold=True)
        pdf.set_xy(MARGIN_LEFT, MARGIN_TOP)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(
            PAGE_W - MARGIN_LEFT - MARGIN_RIGHT,
            HEADER_HEIGHT,
            header,
            border="B",
            align="L",
        )
        pdf.set_text_color(0, 0, 0)
        header_total = HEADER_HEIGHT + 2.0  # 2mm gap after header line
        y_pos[0] = MARGIN_TOP + header_total
        y_pos[1] = MARGIN_TOP + header_total

    def _available_height(c: int) -> float:
        return PAGE_H - MARGIN_BOTTOM - y_pos[c]

    def _place_item(item: dict) -> None:
        nonlocal col, y_pos, current_header

        # Determine header for this item
        header = f"{header_text_prefix}{item['problem_set_name']} - {item['chapter_name']}"

        # Calculate image dimensions scaled to column width
        img_w = COLUMN_WIDTH
        img_h = (item["height"] / item["width"]) * img_w if item["width"] > 0 else 40.0
        spacer_h = img_h * spacer_ratio

        total_block = PROBLEM_LABEL_HEIGHT + img_h + spacer_h

        # If even a fresh column on a new page can't fit this block, cap spacer
        max_col_height = USABLE_HEIGHT - HEADER_HEIGHT - 2.0
        if total_block > max_col_height:
            spacer_h = max(0, max_col_height - PROBLEM_LABEL_HEIGHT - img_h)
            total_block = PROBLEM_LABEL_HEIGHT + img_h + spacer_h

        # Check if we need a new page or column
        if current_header != header or pdf.page == 0:
            if pdf.page == 0:
                _start_new_page(header)
            elif current_header != header:
                # New chapter/problem_set -> new page
                _start_new_page(header)
            current_header = header

        if _available_height(col) < total_block:
            if col == 0:
                col = 1
                if _available_height(col) < total_block:
                    _start_new_page(header)
                    current_header = header
            else:
                _start_new_page(header)
                current_header = header

        x = _col_x(col)
        y = y_pos[col]

        # Draw problem number label
        pdf._set_font(PROBLEM_LABEL_FONT_SIZE, bold=False)
        pdf.set_text_color(60, 60, 60)
        pdf.set_xy(x, y)
        pdf.cell(COLUMN_WIDTH, PROBLEM_LABEL_HEIGHT, f"{item['number']}번", align="L")
        pdf.set_text_color(0, 0, 0)
        y += PROBLEM_LABEL_HEIGHT

        # Draw image
        image_path = item["image_path"]
        if Path(image_path).exists():
            pdf.image(image_path, x=x, y=y, w=img_w)
        else:
            # Draw placeholder rectangle
            pdf.set_draw_color(200, 200, 200)
            pdf.rect(x, y, img_w, img_h)
            pdf._set_font(7)
            pdf.set_xy(x, y + img_h / 2 - 3)
            pdf.cell(img_w, 6, "Image not found", align="C")
            pdf.set_draw_color(0, 0, 0)
            logger.warning("Image not found: %s", image_path)

        y += img_h + spacer_h
        y_pos[col] = y

    for item in items:
        _place_item(item)


def _add_divider_page(pdf: _WrongAnswerPDF, student_name: str) -> None:
    """Add a full-page divider with the student's name centered."""
    pdf.add_page()
    pdf._set_font(DIVIDER_FONT_SIZE, bold=True)
    pdf.set_text_color(40, 40, 40)

    text_y = PAGE_H / 2 - 10
    pdf.set_xy(MARGIN_LEFT, text_y)
    pdf.cell(
        PAGE_W - MARGIN_LEFT - MARGIN_RIGHT,
        20,
        student_name,
        align="C",
    )
    pdf.set_text_color(0, 0, 0)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def generate_wrong_answer_pdf(
    wrong_answer_set_id: int,
    spacer_ratio: float = 1.0,
) -> str:
    """Generate PDF for a single student's wrong answer set.

    Returns the output filename (relative to PDF_OUTPUT_DIR).

    Algorithm:
    1. Fetch wrong answer entries from DB (chapters + problem numbers)
    2. For each entry, look up the corresponding problem images
    3. Layout images in 2-column format with spacer space below each
    4. Add page headers with problem set name + chapter name
    5. Scale images to fit column width, maintain aspect ratio
    6. Track current y position per column
    7. If image + spacer doesn't fit current column:
       - If left column: move to right column
       - If right column: new page, reset to left column

    spacer_ratio: multiply problem image height by this to get spacer height
    (1.0 = same space as problem, 0.5 = half, 2.0 = double)
    """
    data = _fetch_set_data(wrong_answer_set_id)

    pdf = _WrongAnswerPDF()

    prefix = f"{data['student_name']} | " if data["student_name"] else ""
    _layout_items(pdf, data["items"], spacer_ratio, prefix)

    if not data["items"]:
        pdf.add_page()
        pdf._set_font(12)
        pdf.set_xy(MARGIN_LEFT, PAGE_H / 2 - 5)
        pdf.cell(
            PAGE_W - MARGIN_LEFT - MARGIN_RIGHT,
            10,
            "등록된 오답이 없습니다.",
            align="C",
        )

    filename = f"wrong_answers_{wrong_answer_set_id}_{uuid.uuid4().hex[:8]}.pdf"
    output_path = PDF_OUTPUT_DIR / filename
    pdf.output(str(output_path))

    logger.info(
        "Generated PDF: %s (%d items)", filename, len(data["items"])
    )
    return filename


def generate_batch_pdf(
    wrong_answer_set_ids: list[int],
    spacer_ratio: float = 1.0,
    include_dividers: bool = True,
) -> str:
    """Generate a single PDF with multiple students' wrong answers.

    If include_dividers is True, add a divider page between students
    with the student's name centered on the page.

    Returns the output filename.
    """
    if not wrong_answer_set_ids:
        raise ValueError("At least one wrong answer set ID is required")

    pdf = _WrongAnswerPDF()

    for idx, set_id in enumerate(wrong_answer_set_ids):
        data = _fetch_set_data(set_id)

        if include_dividers:
            _add_divider_page(pdf, data["student_name"])

        prefix = f"{data['student_name']} | " if data["student_name"] else ""
        _layout_items(pdf, data["items"], spacer_ratio, prefix)

        if not data["items"]:
            pdf.add_page()
            pdf._set_font(12)
            pdf.set_xy(MARGIN_LEFT, PAGE_H / 2 - 5)
            pdf.cell(
                PAGE_W - MARGIN_LEFT - MARGIN_RIGHT,
                10,
                f"{data['student_name']} - 등록된 오답이 없습니다.",
                align="C",
            )

    filename = f"batch_{uuid.uuid4().hex[:8]}.pdf"
    output_path = PDF_OUTPUT_DIR / filename
    pdf.output(str(output_path))

    logger.info(
        "Generated batch PDF: %s (%d students)", filename, len(wrong_answer_set_ids)
    )
    return filename
