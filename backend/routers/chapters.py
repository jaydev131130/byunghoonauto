from fastapi import APIRouter, HTTPException

from backend.database import get_db
from backend.services.integrity import check_chapter_integrity, repair_chapter

router = APIRouter(prefix="/api/chapters", tags=["chapters"])


@router.get("/{chapter_id}/health")
async def chapter_health(chapter_id: int):
    """Check DB<->filesystem integrity for a chapter."""
    result = check_chapter_integrity(chapter_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/{chapter_id}/repair")
async def repair_chapter_endpoint(chapter_id: int):
    """Re-extract a chapter from its source PDF to fix integrity issues."""
    try:
        result = repair_chapter(chapter_id)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{chapter_id}/problems")
async def list_chapter_problems(chapter_id: int):
    with get_db() as db:
        chapter = db.execute(
            "SELECT id, name, problem_set_id FROM chapters WHERE id = ?",
            (chapter_id,),
        ).fetchone()
        if not chapter:
            raise HTTPException(status_code=404, detail="단원을 찾을 수 없습니다.")

        problems = db.execute(
            """SELECT id, number, image_path, width, height, file_size, page_num, column_pos
               FROM problems
               WHERE chapter_id = ?
               ORDER BY number""",
            (chapter_id,),
        ).fetchall()

    return {
        "chapter": {
            "id": chapter["id"],
            "name": chapter["name"],
            "problem_set_id": chapter["problem_set_id"],
        },
        "problems": [
            {
                "id": p["id"],
                "number": p["number"],
                "image_path": p["image_path"],
                "width": p["width"],
                "height": p["height"],
                "file_size": p["file_size"],
                "page_num": p["page_num"],
                "column_pos": p["column_pos"],
            }
            for p in problems
        ],
    }
