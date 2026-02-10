import json
from datetime import date

from fastapi import APIRouter, HTTPException

from backend.database import get_db
from backend.models import (
    BulkPerStudentCreate,
    BulkWrongAnswerSetCreate,
    WrongAnswerSetCreate,
    WrongAnswerSetResponse,
    WrongAnswerEntryInput,
    WrongAnswerEntrySaveRequest,
    WrongAnswerEntryResponse,
)

router = APIRouter(tags=["wrong_answers"])


@router.get("/api/students/{student_id}/wrong-answer-sets")
def list_sets_for_student(student_id: int) -> list[WrongAnswerSetResponse]:
    with get_db() as db:
        student = db.execute(
            "SELECT id FROM students WHERE id = ?", (student_id,)
        ).fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

        rows = db.execute(
            "SELECT id, student_id, title, created_at "
            "FROM wrong_answer_sets WHERE student_id = ? ORDER BY created_at DESC",
            (student_id,),
        ).fetchall()
        return [WrongAnswerSetResponse(**dict(r)) for r in rows]


@router.post("/api/wrong-answer-sets", status_code=201)
def create_set(body: WrongAnswerSetCreate) -> WrongAnswerSetResponse:
    with get_db() as db:
        student = db.execute(
            "SELECT id FROM students WHERE id = ?", (body.student_id,)
        ).fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

        title = body.title if body.title else f"오답노트 {date.today().isoformat()}"
        cursor = db.execute(
            "INSERT INTO wrong_answer_sets (student_id, title) VALUES (?, ?)",
            (body.student_id, title),
        )
        db.commit()
        row = db.execute(
            "SELECT id, student_id, title, created_at "
            "FROM wrong_answer_sets WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return WrongAnswerSetResponse(**dict(row))


# ---- Static path routes MUST come before {set_id} parameterized routes ----


@router.post("/api/wrong-answer-sets/bulk", status_code=201)
def bulk_create_sets(body: BulkWrongAnswerSetCreate) -> dict:
    """Create wrong answer sets for multiple students at once."""
    if not body.student_ids:
        raise HTTPException(status_code=422, detail="학생을 1명 이상 선택해주세요.")
    if not body.entries:
        raise HTTPException(status_code=422, detail="오답 항목을 1개 이상 입력해주세요.")

    title = body.title if body.title else f"오답노트 {date.today().isoformat()}"
    created_ids: list[int] = []

    with get_db() as db:
        for sid in body.student_ids:
            student = db.execute(
                "SELECT id FROM students WHERE id = ?", (sid,)
            ).fetchone()
            if not student:
                raise HTTPException(
                    status_code=404,
                    detail=f"학생 ID {sid}을(를) 찾을 수 없습니다.",
                )

        for entry in body.entries:
            chapter = db.execute(
                "SELECT id FROM chapters WHERE id = ?", (entry.chapter_id,)
            ).fetchone()
            if not chapter:
                raise HTTPException(
                    status_code=422,
                    detail=f"단원 ID {entry.chapter_id}를 찾을 수 없습니다.",
                )

        for sid in body.student_ids:
            cursor = db.execute(
                "INSERT INTO wrong_answer_sets (student_id, title) VALUES (?, ?)",
                (sid, title),
            )
            set_id = cursor.lastrowid
            created_ids.append(set_id)

            for entry in body.entries:
                if entry.problem_numbers:
                    db.execute(
                        "INSERT INTO wrong_answers (wrong_answer_set_id, chapter_id, problem_numbers) "
                        "VALUES (?, ?, ?)",
                        (set_id, entry.chapter_id, json.dumps(entry.problem_numbers)),
                    )

        db.commit()

    return {"created_set_ids": created_ids, "count": len(created_ids)}


@router.get("/api/wrong-answer-sets/recent")
def list_recent_sets() -> list[dict]:
    """Return the 10 most recently created wrong answer sets with student info."""
    with get_db() as db:
        rows = db.execute(
            """SELECT ws.id, ws.student_id, ws.title, ws.created_at,
                      s.name as student_name, s.grade, s.class_name
               FROM wrong_answer_sets ws
               JOIN students s ON s.id = ws.student_id
               ORDER BY ws.created_at DESC
               LIMIT 10"""
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/api/wrong-answer-sets/bulk-per-student")
async def bulk_create_per_student(req: BulkPerStudentCreate):
    """Create wrong answer sets with different entries per student."""
    created_set_ids = []

    with get_db() as db:
        # Validate all student IDs exist
        all_student_ids = [se.student_id for se in req.student_entries]
        placeholders = ",".join("?" * len(all_student_ids))
        existing = db.execute(
            f"SELECT id FROM students WHERE id IN ({placeholders})",
            all_student_ids,
        ).fetchall()
        existing_ids = {row["id"] for row in existing}
        missing = set(all_student_ids) - existing_ids
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"존재하지 않는 학생 ID: {missing}",
            )

        # Validate all chapter IDs
        all_chapter_ids = set()
        for se in req.student_entries:
            for entry in se.entries:
                all_chapter_ids.add(entry.chapter_id)
        if all_chapter_ids:
            ch_placeholders = ",".join("?" * len(all_chapter_ids))
            existing_chapters = db.execute(
                f"SELECT id FROM chapters WHERE id IN ({ch_placeholders})",
                list(all_chapter_ids),
            ).fetchall()
            existing_ch_ids = {row["id"] for row in existing_chapters}
            missing_ch = all_chapter_ids - existing_ch_ids
            if missing_ch:
                raise HTTPException(
                    status_code=400,
                    detail=f"존재하지 않는 단원 ID: {missing_ch}",
                )

        # Create one wrong_answer_set per student with their specific entries
        for student_entry in req.student_entries:
            # Skip students with no entries
            has_problems = any(
                len(e.problem_numbers) > 0 for e in student_entry.entries
            )
            if not has_problems:
                continue

            title = req.title or "오답노트"
            cursor = db.execute(
                "INSERT INTO wrong_answer_sets (student_id, title) VALUES (?, ?)",
                (student_entry.student_id, title),
            )
            set_id = cursor.lastrowid
            created_set_ids.append(set_id)

            for entry in student_entry.entries:
                if not entry.problem_numbers:
                    continue
                db.execute(
                    "INSERT INTO wrong_answers (wrong_answer_set_id, chapter_id, problem_numbers) VALUES (?, ?, ?)",
                    (set_id, entry.chapter_id, json.dumps(entry.problem_numbers)),
                )

        db.commit()

    return {
        "created_set_ids": created_set_ids,
        "count": len(created_set_ids),
    }


# ---- Parameterized {set_id} routes ----


@router.get("/api/wrong-answer-sets/{set_id}")
def get_set(set_id: int) -> dict:
    with get_db() as db:
        row = db.execute(
            "SELECT ws.id, ws.student_id, ws.title, ws.created_at, "
            "s.name as student_name "
            "FROM wrong_answer_sets ws "
            "JOIN students s ON s.id = ws.student_id "
            "WHERE ws.id = ?",
            (set_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="오답노트를 찾을 수 없습니다.")
        return dict(row)


@router.get("/api/wrong-answer-sets/{set_id}/entries")
def get_entries(set_id: int) -> list[WrongAnswerEntryResponse]:
    with get_db() as db:
        ws = db.execute(
            "SELECT id FROM wrong_answer_sets WHERE id = ?", (set_id,)
        ).fetchone()
        if not ws:
            raise HTTPException(status_code=404, detail="오답노트를 찾을 수 없습니다.")

        rows = db.execute(
            "SELECT wa.id, wa.chapter_id, c.name as chapter_name, "
            "ps.name as problem_set_name, wa.problem_numbers "
            "FROM wrong_answers wa "
            "JOIN chapters c ON c.id = wa.chapter_id "
            "JOIN problem_sets ps ON ps.id = c.problem_set_id "
            "WHERE wa.wrong_answer_set_id = ? "
            "ORDER BY ps.name, c.name",
            (set_id,),
        ).fetchall()

        result = []
        for r in rows:
            d = dict(r)
            d["problem_numbers"] = json.loads(d["problem_numbers"])
            result.append(WrongAnswerEntryResponse(**d))
        return result


@router.put("/api/wrong-answer-sets/{set_id}/entries")
def save_entries(
    set_id: int, body: WrongAnswerEntrySaveRequest
) -> list[WrongAnswerEntryResponse]:
    with get_db() as db:
        ws = db.execute(
            "SELECT id FROM wrong_answer_sets WHERE id = ?", (set_id,)
        ).fetchone()
        if not ws:
            raise HTTPException(status_code=404, detail="오답노트를 찾을 수 없습니다.")

        for entry in body.entries:
            chapter = db.execute(
                "SELECT id FROM chapters WHERE id = ?",
                (entry.chapter_id,),
            ).fetchone()
            if not chapter:
                raise HTTPException(
                    status_code=422,
                    detail=f"단원 ID {entry.chapter_id}를 찾을 수 없습니다.",
                )

        db.execute(
            "DELETE FROM wrong_answers WHERE wrong_answer_set_id = ?", (set_id,)
        )

        for entry in body.entries:
            db.execute(
                "INSERT INTO wrong_answers (wrong_answer_set_id, chapter_id, problem_numbers) "
                "VALUES (?, ?, ?)",
                (set_id, entry.chapter_id, json.dumps(entry.problem_numbers)),
            )

        db.commit()

        rows = db.execute(
            "SELECT wa.id, wa.chapter_id, c.name as chapter_name, "
            "ps.name as problem_set_name, wa.problem_numbers "
            "FROM wrong_answers wa "
            "JOIN chapters c ON c.id = wa.chapter_id "
            "JOIN problem_sets ps ON ps.id = c.problem_set_id "
            "WHERE wa.wrong_answer_set_id = ? "
            "ORDER BY ps.name, c.name",
            (set_id,),
        ).fetchall()

        result = []
        for r in rows:
            d = dict(r)
            d["problem_numbers"] = json.loads(d["problem_numbers"])
            result.append(WrongAnswerEntryResponse(**d))
        return result


@router.delete("/api/wrong-answer-sets/{set_id}")
def delete_set(set_id: int) -> dict:
    with get_db() as db:
        ws = db.execute(
            "SELECT id FROM wrong_answer_sets WHERE id = ?", (set_id,)
        ).fetchone()
        if not ws:
            raise HTTPException(status_code=404, detail="오답노트를 찾을 수 없습니다.")

        db.execute(
            "DELETE FROM wrong_answers WHERE wrong_answer_set_id = ?", (set_id,)
        )
        db.execute("DELETE FROM wrong_answer_sets WHERE id = ?", (set_id,))
        db.commit()
        return {"ok": True}
