from fastapi import APIRouter, HTTPException

from backend.database import get_db
from backend.models import StudentCreate, StudentUpdate, StudentResponse

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("")
def list_students() -> list[StudentResponse]:
    with get_db() as db:
        rows = db.execute(
            "SELECT id, name, grade, class_name, contact, memo, created_at "
            "FROM students ORDER BY name"
        ).fetchall()
        return [StudentResponse(**dict(r)) for r in rows]


@router.post("", status_code=201)
def create_student(body: StudentCreate) -> StudentResponse:
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="이름은 필수 항목입니다.")
    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO students (name, grade, class_name, contact, memo) "
            "VALUES (?, ?, ?, ?, ?)",
            (body.name.strip(), body.grade, body.class_name, body.contact, body.memo),
        )
        db.commit()
        row = db.execute(
            "SELECT id, name, grade, class_name, contact, memo, created_at "
            "FROM students WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return StudentResponse(**dict(row))


@router.put("/{student_id}")
def update_student(student_id: int, body: StudentUpdate) -> StudentResponse:
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM students WHERE id = ?", (student_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

        fields = []
        values = []
        if body.name is not None:
            if not body.name.strip():
                raise HTTPException(status_code=422, detail="이름은 비워둘 수 없습니다.")
            fields.append("name = ?")
            values.append(body.name.strip())
        if body.grade is not None:
            fields.append("grade = ?")
            values.append(body.grade)
        if body.class_name is not None:
            fields.append("class_name = ?")
            values.append(body.class_name)
        if body.contact is not None:
            fields.append("contact = ?")
            values.append(body.contact)
        if body.memo is not None:
            fields.append("memo = ?")
            values.append(body.memo)

        if fields:
            values.append(student_id)
            db.execute(
                f"UPDATE students SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            db.commit()

        row = db.execute(
            "SELECT id, name, grade, class_name, contact, memo, created_at "
            "FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()
        return StudentResponse(**dict(row))


@router.delete("/{student_id}")
def delete_student(student_id: int) -> dict:
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM students WHERE id = ?", (student_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

        db.execute(
            "DELETE FROM wrong_answers WHERE wrong_answer_set_id IN "
            "(SELECT id FROM wrong_answer_sets WHERE student_id = ?)",
            (student_id,),
        )
        db.execute(
            "DELETE FROM wrong_answer_sets WHERE student_id = ?", (student_id,)
        )
        db.execute("DELETE FROM students WHERE id = ?", (student_id,))
        db.commit()
        return {"ok": True}
