import sys
import tempfile
import types
import unittest
from pathlib import Path


fpdf_stub = types.ModuleType("fpdf")
fpdf_stub.FPDF = type("FPDF", (), {})
sys.modules.setdefault("fpdf", fpdf_stub)

from backend.services import pdf_generator
from backend.services.wrong_answer_title import (
    build_default_title,
    resolve_wrong_answer_title,
)


class PdfGeneratorNamingTests(unittest.TestCase):
    def test_build_header_title_uses_plain_wrong_answer_set_title(self) -> None:
        self.assertEqual(
            pdf_generator._build_pdf_title_label("3/12 고2 김주흔"),
            "3/12 고2 김주흔",
        )

    def test_build_page_header_appends_problem_set_and_chapter(self) -> None:
        self.assertEqual(
            pdf_generator._build_page_header(
                "3/12 고2 김주흔",
                "대수 개념원리+rpm",
                "8단원",
            ),
            "3/12 고2 김주흔 <대수 개념원리+rpm 8단원>",
        )

    def test_build_output_filename_uses_windows_safe_characters(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)

            filename = pdf_generator._build_output_filename(
                "3/12 고2 김주흔 <대수:개념원리+rpm 8단원>",
                output_dir=output_dir,
            )

            self.assertEqual(filename, "3／12 고2 김주흔 ＜대수：개념원리+rpm 8단원＞.pdf")

    def test_build_output_filename_avoids_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            (output_dir / "3／12 고2 김주흔.pdf").write_bytes(b"existing")

            filename = pdf_generator._build_output_filename(
                "3/12 고2 김주흔",
                output_dir=output_dir,
            )

            self.assertEqual(filename, "3／12 고2 김주흔 (2).pdf")

    def test_build_default_title_includes_month_day_grade_and_name(self) -> None:
        self.assertEqual(
            build_default_title("김주흔", "고2", "2026-03-12 09:30:00"),
            "3/12 고2 김주흔",
        )

    def test_resolve_wrong_answer_title_replaces_legacy_defaults(self) -> None:
        self.assertEqual(
            resolve_wrong_answer_title(
                "오답노트 2026-03-12",
                "김주흔",
                "고2",
                "2026-03-12 09:30:00",
            ),
            "3/12 고2 김주흔",
        )


if __name__ == "__main__":
    unittest.main()
