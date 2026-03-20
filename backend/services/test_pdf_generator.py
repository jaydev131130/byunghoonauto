import sys
import tempfile
import types
import unittest
from pathlib import Path


fpdf_stub = types.ModuleType("fpdf")
fpdf_stub.FPDF = type("FPDF", (), {})
sys.modules.setdefault("fpdf", fpdf_stub)

from backend.services import pdf_generator


class PdfGeneratorNamingTests(unittest.TestCase):
    def test_build_header_title_uses_wrong_answer_set_title(self) -> None:
        self.assertEqual(
            pdf_generator._build_pdf_title_label("오답노트 중간고사"),
            '오답노트 "중간고사"',
        )

    def test_build_output_filename_uses_windows_safe_quotes(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)

            filename = pdf_generator._build_output_filename(
                "중간:고사/1회",
                output_dir=output_dir,
            )

            self.assertEqual(filename, "오답노트 “중간：고사／1회”.pdf")

    def test_build_output_filename_avoids_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            (output_dir / "오답노트 “중간고사”.pdf").write_bytes(b"existing")

            filename = pdf_generator._build_output_filename(
                "중간고사",
                output_dir=output_dir,
            )

            self.assertEqual(filename, "오답노트 “중간고사” (2).pdf")


if __name__ == "__main__":
    unittest.main()
