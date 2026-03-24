import fitz
import re
from pathlib import Path
from typing import Generator

MIDPOINT = 298  # A4 page center for 2-column layout
QUESTION_NUMBER_RE = re.compile(r"^\d+\.$")
EDGE_PADDING = 4.0
BOTTOM_PADDING = 6.0
RENDER_SCALE = 2.0


def _column_pos(x0: float) -> str:
    return "left" if x0 < MIDPOINT else "right"


def _extract_question_anchors(page: fitz.Page) -> list[dict]:
    anchors: list[dict] = []

    for word in page.get_text("words"):
        text = word[4].strip()
        if not QUESTION_NUMBER_RE.match(text):
            continue

        x0, y0, x1, y1 = word[:4]
        anchors.append(
            {
                "number": int(text[:-1]),
                "bbox": (x0, y0, x1, y1),
                "x0": x0,
                "y0": y0,
                "column_pos": _column_pos(x0),
            }
        )

    anchors.sort(key=lambda a: (0 if a["column_pos"] == "left" else 1, a["y0"]))
    return anchors


def _group_blocks_by_question(
    anchors: list[dict],
    image_blocks: list[dict],
) -> list[dict]:
    groups: list[dict] = []
    blocks_by_column = {
        "left": sorted(
            [b for b in image_blocks if _column_pos(b["bbox"][0]) == "left"],
            key=lambda b: b["bbox"][1],
        ),
        "right": sorted(
            [b for b in image_blocks if _column_pos(b["bbox"][0]) == "right"],
            key=lambda b: b["bbox"][1],
        ),
    }

    for column in ("left", "right"):
        column_anchors = [a for a in anchors if a["column_pos"] == column]
        column_blocks = blocks_by_column[column]

        for idx, anchor in enumerate(column_anchors):
            next_y = column_anchors[idx + 1]["y0"] if idx + 1 < len(column_anchors) else None
            matching_blocks = [
                block
                for block in column_blocks
                if block["bbox"][3] > anchor["y0"] - 1
                and (next_y is None or block["bbox"][1] < next_y - 1)
            ]

            if not matching_blocks:
                continue

            groups.append(
                {
                    "number": anchor["number"],
                    "column_pos": column,
                    "anchor_bbox": anchor["bbox"],
                    "blocks": matching_blocks,
                }
            )

    groups.sort(key=lambda group: group["number"])
    return groups


def _build_problem_regions(
    anchors: list[dict],
    image_blocks: list[dict],
    page_rect: fitz.Rect,
) -> list[dict]:
    regions: list[dict] = []

    for group in _group_blocks_by_question(anchors, image_blocks):
        block_boxes = [block["bbox"] for block in group["blocks"]]
        x0 = max(
            page_rect.x0,
            min(box[0] for box in block_boxes) - EDGE_PADDING,
        )
        y0 = max(page_rect.y0, min(box[1] for box in block_boxes) - EDGE_PADDING)
        x1 = min(
            page_rect.x1,
            max(box[2] for box in block_boxes) + EDGE_PADDING,
        )
        y1 = min(page_rect.y1, max(box[3] for box in block_boxes) + BOTTOM_PADDING)

        regions.append(
            {
                "number": group["number"],
                "column_pos": group["column_pos"],
                "bbox": (x0, y0, x1, y1),
            }
        )

    return regions


def _extract_from_regions(
    page: fitz.Page,
    page_idx: int,
    regions: list[dict],
    output_dir: Path,
) -> Generator[dict, None, None]:
    for region in regions:
        filename = f"{region['number']:03d}.jpg"
        filepath = output_dir / filename

        pix = page.get_pixmap(
            clip=fitz.Rect(region["bbox"]),
            matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE),
            alpha=False,
        )
        pix.save(str(filepath))

        yield {
            "number": region["number"],
            "filename": filename,
            "width": pix.width,
            "height": pix.height,
            "file_size": filepath.stat().st_size,
            "page_num": page_idx + 1,
            "column_pos": region["column_pos"],
        }


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
            anchors = _extract_question_anchors(page)
            regions = _build_problem_regions(anchors, img_blocks, page.rect)

            if regions:
                yield from _extract_from_regions(page, page_idx, regions, output_dir)
                continue

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

                file_size = len(img_data)
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
