import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config import IMAGES_DIR
from backend.database import get_db
from backend.services.image_store import delete_problem_image

logger = logging.getLogger(__name__)
router = APIRouter(tags=["problems"])


def _safe_path(relative: str) -> Path:
    """Resolve path and ensure it stays within IMAGES_DIR."""
    resolved = (IMAGES_DIR / relative).resolve()
    if not str(resolved).startswith(str(IMAGES_DIR.resolve())):
        raise HTTPException(status_code=400, detail="잘못된 파일 경로입니다.")
    return resolved


class ReorderRequest(BaseModel):
    order: list[int] = Field(min_length=1)


class BulkShiftRequest(BaseModel):
    from_number: int = Field(ge=1)
    shift: int


class NumberUpdateRequest(BaseModel):
    number: int = Field(ge=1)


@router.put("/api/chapters/{chapter_id}/problems/reorder")
async def reorder_problems(chapter_id: int, req: ReorderRequest):
    with get_db() as db:
        chapter = db.execute(
            "SELECT id, problem_set_id FROM chapters WHERE id = ?",
            (chapter_id,),
        ).fetchone()
        if not chapter:
            raise HTTPException(status_code=404, detail="단원을 찾을 수 없습니다.")

        problems = db.execute(
            "SELECT id, image_path FROM problems WHERE chapter_id = ?",
            (chapter_id,),
        ).fetchall()

        problem_map = {p["id"]: p for p in problems}
        problem_ids = set(problem_map.keys())
        order_ids = set(req.order)

        # Validate: no duplicates
        if len(req.order) != len(order_ids):
            raise HTTPException(status_code=400, detail="중복된 문제 ID가 있습니다.")

        # Validate: exact match (no missing, no extra)
        if order_ids != problem_ids:
            missing = problem_ids - order_ids
            extra = order_ids - problem_ids
            details = []
            if missing:
                details.append(f"누락: {missing}")
            if extra:
                details.append(f"존재하지 않음: {extra}")
            raise HTTPException(status_code=400, detail=", ".join(details))

        chapter_dir = IMAGES_DIR / str(chapter["problem_set_id"]) / str(chapter_id)
        staging_dir = chapter_dir / ".staging"

        logger.info("Reordering %d problems in chapter %d", len(req.order), chapter_id)

        # Phase 1: Move all files to staging directory (isolated namespace)
        staging_dir.mkdir(exist_ok=True)
        original_files: dict[int, str] = {}  # pid -> original filename
        for pid in req.order:
            old_path = problem_map[pid]["image_path"]
            old_file = _safe_path(old_path)
            if old_file.is_file():
                staged = staging_dir / old_file.name
                old_file.rename(staged)
                original_files[pid] = old_file.name

        # Phase 2: Move from staging to final names + DB update
        moved_to_final: dict[int, tuple[Path, str]] = {}  # pid -> (final_path, orig_name)
        try:
            # Clear all numbers to negative temporaries to avoid UNIQUE constraint
            for idx, pid in enumerate(req.order):
                db.execute(
                    "UPDATE problems SET number = ? WHERE id = ?",
                    (-(idx + 1), pid),
                )

            # Set final numbers and paths
            for new_number, pid in enumerate(req.order, start=1):
                old_path = problem_map[pid]["image_path"]
                ext = Path(old_path).suffix or ".jpg"
                new_filename = f"{new_number:03d}{ext}"
                new_path = f"{chapter['problem_set_id']}/{chapter_id}/{new_filename}"

                if pid in original_files:
                    staged = staging_dir / original_files[pid]
                    final = chapter_dir / new_filename
                    if staged.is_file():
                        staged.rename(final)
                        moved_to_final[pid] = (final, original_files[pid])

                db.execute(
                    "UPDATE problems SET number = ?, image_path = ? WHERE id = ?",
                    (new_number, new_path, pid),
                )

            db.commit()
        except Exception:
            logger.error("Rollback triggered during reorder for chapter %d", chapter_id)
            # Restore files already moved to final back to original names
            for pid, (final_path, orig_name) in moved_to_final.items():
                original = chapter_dir / orig_name
                if final_path.is_file() and not original.exists():
                    final_path.rename(original)
            # Restore remaining staged files
            for pid, orig_name in original_files.items():
                if pid not in moved_to_final:
                    staged = staging_dir / orig_name
                    original = chapter_dir / orig_name
                    if staged.is_file() and not original.exists():
                        staged.rename(original)
            if staging_dir.exists():
                shutil.rmtree(staging_dir, ignore_errors=True)
            raise

        # Cleanup staging dir (outside try/except - non-critical)
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)

    return {"status": "reordered"}


@router.put("/api/chapters/{chapter_id}/problems/bulk-shift")
async def bulk_shift_problems(chapter_id: int, req: BulkShiftRequest):
    if req.shift == 0:
        return {"status": "shifted"}

    with get_db() as db:
        chapter = db.execute(
            "SELECT id, problem_set_id FROM chapters WHERE id = ?",
            (chapter_id,),
        ).fetchone()
        if not chapter:
            raise HTTPException(status_code=404, detail="단원을 찾을 수 없습니다.")

        problems = db.execute(
            """SELECT id, number, image_path FROM problems
               WHERE chapter_id = ? AND number >= ?
               ORDER BY number""",
            (chapter_id, req.from_number),
        ).fetchall()

        if not problems:
            return {"status": "shifted"}

        # Pre-validate: no number below 1
        for prob in problems:
            new_number = prob["number"] + req.shift
            if new_number < 1:
                raise HTTPException(
                    status_code=400,
                    detail=f"번호가 1 미만이 됩니다 (문제 {prob['number']} → {new_number})",
                )

        # Check collisions with problems NOT being shifted
        existing_numbers = {
            row["number"]
            for row in db.execute(
                "SELECT number FROM problems WHERE chapter_id = ? AND number < ?",
                (chapter_id, req.from_number),
            ).fetchall()
        }
        for prob in problems:
            new_number = prob["number"] + req.shift
            if new_number in existing_numbers:
                raise HTTPException(
                    status_code=400,
                    detail=f"번호 {new_number}이 이미 사용 중입니다.",
                )

        # Sort to avoid file collision: shift>0 descending, shift<0 ascending
        ordered = sorted(
            problems,
            key=lambda p: -p["number"] if req.shift > 0 else p["number"],
        )

        renamed_files: list[tuple[Path, Path]] = []  # (new_file, old_file) for rollback

        try:
            for prob in ordered:
                new_number = prob["number"] + req.shift
                ext = Path(prob["image_path"]).suffix or ".jpg"
                new_filename = f"{new_number:03d}{ext}"
                new_path = f"{chapter['problem_set_id']}/{chapter_id}/{new_filename}"

                old_file = _safe_path(prob["image_path"])
                new_file = _safe_path(new_path)
                if old_file.is_file() and old_file != new_file:
                    new_file.parent.mkdir(parents=True, exist_ok=True)
                    old_file.rename(new_file)
                    renamed_files.append((new_file, old_file))

                db.execute(
                    "UPDATE problems SET number = ?, image_path = ? WHERE id = ?",
                    (new_number, new_path, prob["id"]),
                )

            db.commit()
        except Exception:
            logger.error("Rollback triggered during bulk-shift for chapter %d", chapter_id)
            for new_file, old_file in reversed(renamed_files):
                if new_file.is_file():
                    old_file.parent.mkdir(parents=True, exist_ok=True)
                    new_file.rename(old_file)
            raise

    return {"status": "shifted"}


@router.put("/api/problems/{problem_id}/number")
async def update_problem_number(problem_id: int, req: NumberUpdateRequest):
    with get_db() as db:
        prob = db.execute(
            "SELECT id, number, image_path, chapter_id FROM problems WHERE id = ?",
            (problem_id,),
        ).fetchone()
        if not prob:
            raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

        existing = db.execute(
            "SELECT id FROM problems WHERE chapter_id = ? AND number = ? AND id != ?",
            (prob["chapter_id"], req.number, problem_id),
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=400, detail=f"번호 {req.number}이 이미 사용 중입니다."
            )

        # Get chapter info for path construction
        chapter = db.execute(
            "SELECT problem_set_id FROM chapters WHERE id = ?",
            (prob["chapter_id"],),
        ).fetchone()

        ext = Path(prob["image_path"]).suffix or ".jpg"
        new_filename = f"{req.number:03d}{ext}"
        new_path = f"{chapter['problem_set_id']}/{prob['chapter_id']}/{new_filename}"

        old_file = _safe_path(prob["image_path"])
        new_file = _safe_path(new_path)
        file_renamed = False

        try:
            if old_file.is_file() and old_file != new_file:
                old_file.rename(new_file)
                file_renamed = True

            db.execute(
                "UPDATE problems SET number = ?, image_path = ? WHERE id = ?",
                (req.number, new_path, problem_id),
            )
            db.commit()
        except Exception:
            if file_renamed and new_file.is_file():
                new_file.rename(old_file)
            raise

    return {"status": "updated", "number": req.number}


@router.delete("/api/problems/{problem_id}")
async def delete_problem(problem_id: int):
    with get_db() as db:
        prob = db.execute(
            "SELECT id, image_path, chapter_id FROM problems WHERE id = ?",
            (problem_id,),
        ).fetchone()
        if not prob:
            raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

        image_path = prob["image_path"]
        chapter_id = prob["chapter_id"]

        db.execute("DELETE FROM problems WHERE id = ?", (problem_id,))
        db.execute(
            "UPDATE chapters SET total_problems = total_problems - 1 WHERE id = ? AND total_problems > 0",
            (chapter_id,),
        )
        db.commit()

    # File cleanup after successful DB commit (non-critical)
    delete_problem_image(image_path)
    return {"status": "deleted"}
