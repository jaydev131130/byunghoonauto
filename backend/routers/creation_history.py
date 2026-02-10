import json
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.database import get_db

router = APIRouter(prefix="/api/creation-history", tags=["creation-history"])

RETENTION_DAYS = 10


class HistoryEntryInput(BaseModel):
    chapter_id: int
    problem_numbers: list[int]


class StudentEntryInput(BaseModel):
    student_id: int
    entries: list[HistoryEntryInput]


class CreateHistoryRequest(BaseModel):
    title: str
    problem_set_id: int
    problem_set_ids: list[int] | None = None
    # Legacy format
    entries: list[HistoryEntryInput] | None = None
    student_ids: list[int] | None = None
    # New per-student format
    student_entries: list[StudentEntryInput] | None = None


@router.post("")
async def save_history(req: CreateHistoryRequest):
    _cleanup_old_entries()

    data_dict: dict = {}

    # Store problem_set_ids if provided (multi-select)
    if req.problem_set_ids and len(req.problem_set_ids) > 0:
        data_dict["problem_set_ids"] = req.problem_set_ids

    # New per-student format
    if req.student_entries and len(req.student_entries) > 0:
        data_dict["student_entries"] = [
            {
                "student_id": se.student_id,
                "entries": [
                    {"chapter_id": e.chapter_id, "problem_numbers": e.problem_numbers}
                    for e in se.entries
                ],
            }
            for se in req.student_entries
        ]
    elif req.entries and req.student_ids:
        # Legacy format
        data_dict["entries"] = [
            {"chapter_id": e.chapter_id, "problem_numbers": e.problem_numbers}
            for e in req.entries
        ]
        data_dict["student_ids"] = req.student_ids

    input_data = json.dumps(data_dict, ensure_ascii=False)
    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO creation_history (title, problem_set_id, input_data) VALUES (?, ?, ?)",
            (req.title, req.problem_set_id, input_data),
        )
        db.commit()
        return {"id": cursor.lastrowid, "status": "saved"}


@router.get("")
async def list_history():
    _cleanup_old_entries()
    with get_db() as db:
        rows = db.execute(
            """SELECT h.id, h.title, h.problem_set_id, h.input_data, h.created_at,
                      ps.name as problem_set_name
               FROM creation_history h
               LEFT JOIN problem_sets ps ON h.problem_set_id = ps.id
               ORDER BY h.created_at DESC"""
        ).fetchall()

    result = []
    for row in rows:
        data = json.loads(row["input_data"])

        # Compute total problems and student count
        student_entries = data.get("student_entries", [])
        if student_entries:
            total = sum(
                len(e["problem_numbers"])
                for se in student_entries
                for e in se.get("entries", [])
            )
            student_count = len(student_entries)
        else:
            total = sum(len(e["problem_numbers"]) for e in data.get("entries", []))
            student_count = len(data.get("student_ids", []))

        # Resolve problem_set_ids to names
        ps_ids = data.get("problem_set_ids", [])
        ps_names: list[str] = []
        if ps_ids:
            with get_db() as db2:
                placeholders = ",".join("?" for _ in ps_ids)
                name_rows = db2.execute(
                    f"SELECT id, name FROM problem_sets WHERE id IN ({placeholders})",
                    ps_ids,
                ).fetchall()
            name_map = {r["id"]: r["name"] for r in name_rows}
            ps_names = [name_map.get(pid, "") for pid in ps_ids if name_map.get(pid)]

        item = {
            "id": row["id"],
            "title": row["title"],
            "problem_set_id": row["problem_set_id"],
            "problem_set_name": row["problem_set_name"],
            "total_problems": total,
            "student_count": student_count,
            "created_at": row["created_at"],
        }

        # Include multi-ps fields if present
        if ps_ids:
            item["problem_set_ids"] = ps_ids
            item["problem_set_names"] = ps_names

        # Include student_entries or legacy entries
        if student_entries:
            item["student_entries"] = student_entries
        else:
            item["entries"] = data.get("entries", [])
            item["student_ids"] = data.get("student_ids", [])

        result.append(item)
    return {"history": result}


@router.get("/{history_id}")
async def get_history(history_id: int):
    with get_db() as db:
        row = db.execute(
            """SELECT h.id, h.title, h.problem_set_id, h.input_data, h.created_at,
                      ps.name as problem_set_name
               FROM creation_history h
               LEFT JOIN problem_sets ps ON h.problem_set_id = ps.id
               WHERE h.id = ?""",
            (history_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="히스토리를 찾을 수 없습니다.")
    data = json.loads(row["input_data"])
    return {
        "id": row["id"],
        "title": row["title"],
        "problem_set_id": row["problem_set_id"],
        "problem_set_name": row["problem_set_name"],
        "entries": data.get("entries", []),
        "student_ids": data.get("student_ids", []),
        "created_at": row["created_at"],
    }


@router.delete("/{history_id}")
async def delete_history(history_id: int):
    with get_db() as db:
        db.execute("DELETE FROM creation_history WHERE id = ?", (history_id,))
        db.commit()
    return {"status": "deleted"}


def _cleanup_old_entries():
    cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    with get_db() as db:
        db.execute("DELETE FROM creation_history WHERE created_at < ?", (cutoff,))
        db.commit()
