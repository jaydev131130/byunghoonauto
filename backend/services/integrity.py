import logging
import shutil
from pathlib import Path

from backend.config import IMAGES_DIR
from backend.database import get_db
from backend.services.extractor import extract_chapter

logger = logging.getLogger(__name__)


def check_chapter_integrity(chapter_id: int) -> dict:
    """Check if DB records match actual image files for a chapter.

    Returns:
        {
            "chapter_id": int,
            "problem_count": int,      # DB records
            "image_count": int,        # actual files on disk
            "missing_files": [int],    # problem numbers with DB record but no file
            "orphan_files": [str],     # files on disk with no DB record
            "healthy": bool,
        }
    """
    with get_db() as db:
        chapter = db.execute(
            "SELECT c.id, c.problem_set_id FROM chapters c WHERE c.id = ?",
            (chapter_id,),
        ).fetchone()
        if not chapter:
            return {"error": "chapter not found"}

        problems = db.execute(
            "SELECT number, image_path FROM problems WHERE chapter_id = ?",
            (chapter_id,),
        ).fetchall()

    problem_set_id = chapter["problem_set_id"]
    chapter_dir = IMAGES_DIR / str(problem_set_id) / str(chapter_id)

    # DB side
    db_numbers = {}
    for p in problems:
        db_numbers[p["number"]] = p["image_path"]

    # Filesystem side
    disk_files = set()
    if chapter_dir.is_dir():
        for f in chapter_dir.iterdir():
            if f.is_file() and f.suffix.lower() in (".jpg", ".jpeg", ".png"):
                disk_files.add(f.name)

    # Check missing (in DB but not on disk)
    missing_files = []
    for num, img_path in db_numbers.items():
        expected_file = Path(img_path).name
        if expected_file not in disk_files:
            missing_files.append(num)

    # Check orphans (on disk but not in DB)
    expected_names = {Path(p).name for p in db_numbers.values()}
    orphan_files = [f for f in sorted(disk_files) if f not in expected_names]

    return {
        "chapter_id": chapter_id,
        "problem_count": len(db_numbers),
        "image_count": len(disk_files),
        "missing_files": sorted(missing_files),
        "orphan_files": orphan_files,
        "healthy": len(missing_files) == 0 and len(orphan_files) == 0,
    }


def check_problem_set_integrity(problem_set_id: int) -> dict:
    """Check integrity of all chapters in a problem set."""
    with get_db() as db:
        chapters = db.execute(
            "SELECT id, name FROM chapters WHERE problem_set_id = ? ORDER BY sort_order",
            (problem_set_id,),
        ).fetchall()

    results = []
    all_healthy = True
    for ch in chapters:
        result = check_chapter_integrity(ch["id"])
        result["name"] = ch["name"]
        results.append(result)
        if not result.get("healthy", False):
            all_healthy = False

    return {
        "problem_set_id": problem_set_id,
        "chapters": results,
        "all_healthy": all_healthy,
    }


def repair_chapter(chapter_id: int) -> dict:
    """Re-extract a chapter from its source PDF.

    Completely replaces all images and DB records for this chapter.
    Returns extraction result summary.
    """
    with get_db() as db:
        chapter = db.execute(
            """SELECT c.id, c.problem_set_id, c.source_filename, ps.source_path
               FROM chapters c
               JOIN problem_sets ps ON c.problem_set_id = ps.id
               WHERE c.id = ?""",
            (chapter_id,),
        ).fetchone()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

    problem_set_id = chapter["problem_set_id"]
    source_filename = chapter["source_filename"]
    source_path = Path(chapter["source_path"])
    pdf_path = source_path / source_filename

    if not pdf_path.is_file():
        raise FileNotFoundError(f"소스 PDF를 찾을 수 없습니다: {pdf_path}")

    output_dir = IMAGES_DIR / str(problem_set_id) / str(chapter_id)

    # Clean up existing data
    with get_db() as db:
        deleted_count = db.execute(
            "DELETE FROM problems WHERE chapter_id = ?", (chapter_id,)
        ).rowcount
        db.commit()

    # Clean up existing files (but keep the directory)
    if output_dir.exists():
        staging = output_dir / ".staging"
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        for f in output_dir.iterdir():
            if f.is_file():
                f.unlink()

    output_dir.mkdir(parents=True, exist_ok=True)

    # Re-extract
    count = 0
    with get_db() as db:
        for prob in extract_chapter(str(pdf_path), output_dir):
            image_path = f"{problem_set_id}/{chapter_id}/{prob['filename']}"
            db.execute(
                """INSERT INTO problems
                   (chapter_id, number, image_path, width, height, file_size, page_num, column_pos)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    chapter_id,
                    prob["number"],
                    image_path,
                    prob["width"],
                    prob["height"],
                    prob["file_size"],
                    prob["page_num"],
                    prob["column_pos"],
                ),
            )
            count += 1

        db.execute(
            "UPDATE chapters SET total_problems = ? WHERE id = ?",
            (count, chapter_id),
        )
        db.commit()

    logger.info("Repaired chapter %d: %d problems extracted", chapter_id, count)

    return {
        "chapter_id": chapter_id,
        "deleted_records": deleted_count,
        "extracted_count": count,
        "image_files": len(list(output_dir.glob("*.jpg"))),
    }
