import fitz
from pathlib import Path
from typing import Generator

MIDPOINT = 298  # A4 page center for 2-column layout


def extract_chapter(pdf_path: str, output_dir: Path) -> Generator[dict, None, None]:
    """Extract problem images from a PDF file.

    Each image block in the PDF = 1 problem.
    2-column sorting: left column (x < MIDPOINT) sorted by y,
    then right column sorted by y.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    problem_number = 0

    try:
        for page_idx, page in enumerate(doc):
            blocks = page.get_text("dict")["blocks"]
            img_blocks = [b for b in blocks if b["type"] == 1]

            sorted_blocks = sorted(
                img_blocks,
                key=lambda b: (0 if b["bbox"][0] < MIDPOINT else 1, b["bbox"][1]),
            )

            for block in sorted_blocks:
                problem_number += 1
                bbox = block["bbox"]

                img_data = block.get("image")
                if not img_data:
                    continue

                width = int(bbox[2] - bbox[0])
                height = int(bbox[3] - bbox[1])

                filename = f"{problem_number:03d}.jpg"
                filepath = output_dir / filename

                with open(filepath, "wb") as f:
                    f.write(img_data)

                file_size = filepath.stat().st_size
                column = "left" if bbox[0] < MIDPOINT else "right"

                yield {
                    "number": problem_number,
                    "filename": filename,
                    "width": width,
                    "height": height,
                    "file_size": file_size,
                    "page_num": page_idx + 1,
                    "column_pos": column,
                }
    finally:
        doc.close()
