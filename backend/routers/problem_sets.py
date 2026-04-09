import shutil
import sqlite3

from fastapi import APIRouter, HTTPException

from backend.config import IMAGES_DIR, UPLOADS_DIR
from backend.database import get_db
from backend.models import ProblemSetUpdate
from backend.services.image_store import delete_problem_set_images
from backend.services.integrity import check_problem_set_integrity

router = APIRouter(prefix="/api/problem-sets", tags=["problem_sets"])


def _delete_problem_set_rows(db, problem_set_id: int) -> None:
    db.execute(
        "DELETE FROM wrong_answers "
        "WHERE chapter_id IN (SELECT id FROM chapters WHERE problem_set_id = ?)",
        (problem_set_id,),
    )
    db.execute(
        "DELETE FROM problems WHERE chapter_id IN (SELECT id FROM chapters WHERE problem_set_id = ?)",
        (problem_set_id,),
    )
    db.execute(
        "DELETE FROM chapters WHERE problem_set_id = ?", (problem_set_id,)
    )
    db.execute("DELETE FROM problem_sets WHERE id = ?", (problem_set_id,))


@router.get("/{problem_set_id}/health")
async def problem_set_health(problem_set_id: int):
    """Check integrity of all chapters in a problem set."""
    return check_problem_set_integrity(problem_set_id)


@router.get("")
async def list_problem_sets():
    with get_db() as db:
        rows = db.execute(
            """SELECT ps.id, ps.name, ps.created_at,
                      COUNT(DISTINCT c.id) as chapter_count,
                      (SELECT COUNT(*) FROM problems p
                       JOIN chapters ch ON p.chapter_id = ch.id
                       WHERE ch.problem_set_id = ps.id) as total_problems
               FROM problem_sets ps
               LEFT JOIN chapters c ON c.problem_set_id = ps.id
               GROUP BY ps.id
               ORDER BY ps.created_at DESC"""
        ).fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "created_at": r["created_at"],
            "chapter_count": r["chapter_count"],
            "total_problems": r["total_problems"],
        }
        for r in rows
    ]


@router.get("/{problem_set_id}")
async def get_problem_set(problem_set_id: int):
    with get_db() as db:
        ps = db.execute(
            "SELECT * FROM problem_sets WHERE id = ?", (problem_set_id,)
        ).fetchone()
        if not ps:
            raise HTTPException(status_code=404, detail="문제집을 찾을 수 없습니다.")

        chapters = db.execute(
            """SELECT c.id, c.name, c.sort_order,
                      COUNT(p.id) as problem_count
               FROM chapters c
               LEFT JOIN problems p ON p.chapter_id = c.id
               WHERE c.problem_set_id = ?
               GROUP BY c.id
               ORDER BY c.sort_order""",
            (problem_set_id,),
        ).fetchall()

    chapter_list = []
    for c in chapters:
        chapter_dir = IMAGES_DIR / str(problem_set_id) / str(c["id"])
        image_count = len(list(chapter_dir.glob("*.jpg"))) if chapter_dir.is_dir() else 0
        chapter_list.append(
            {
                "id": c["id"],
                "name": c["name"],
                "sort_order": c["sort_order"],
                "problem_count": c["problem_count"],
                "image_count": image_count,
            }
        )

    return {
        "id": ps["id"],
        "name": ps["name"],
        "created_at": ps["created_at"],
        "chapters": chapter_list,
    }


@router.put("/{problem_set_id}")
async def update_problem_set(problem_set_id: int, body: ProblemSetUpdate):
    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=422, detail="문제집 이름을 입력해주세요.")

    with get_db() as db:
        ps = db.execute(
            "SELECT id, source_path, created_at, updated_at FROM problem_sets WHERE id = ?",
            (problem_set_id,),
        ).fetchone()
        if not ps:
            raise HTTPException(status_code=404, detail="문제집을 찾을 수 없습니다.")

        try:
            db.execute(
                "UPDATE problem_sets "
                "SET name = ?, updated_at = datetime('now') "
                "WHERE id = ?",
                (new_name, problem_set_id),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(
                status_code=409,
                detail="같은 이름의 문제집이 이미 있습니다.",
            ) from exc

        updated = db.execute(
            "SELECT id, name, source_path, created_at, updated_at FROM problem_sets WHERE id = ?",
            (problem_set_id,),
        ).fetchone()

    return dict(updated)


@router.delete("/{problem_set_id}")
async def delete_problem_set(problem_set_id: int):
    with get_db() as db:
        ps = db.execute(
            "SELECT id FROM problem_sets WHERE id = ?", (problem_set_id,)
        ).fetchone()
        if not ps:
            raise HTTPException(status_code=404, detail="문제집을 찾을 수 없습니다.")

        _delete_problem_set_rows(db, problem_set_id)
        db.commit()

    delete_problem_set_images(problem_set_id)

    uploads_dir = UPLOADS_DIR / str(problem_set_id)
    if uploads_dir.exists():
        shutil.rmtree(uploads_dir)

    return {"status": "deleted"}
