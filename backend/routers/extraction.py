import asyncio
import json
import uuid
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend.config import IMAGES_DIR
from backend.database import get_db
from backend.services.extractor import extract_chapter

router = APIRouter(prefix="/api/extract", tags=["extraction"])

_jobs: dict[str, dict] = {}


class ExtractionRequest(BaseModel):
    folder_path: str


class ExtractionResponse(BaseModel):
    job_id: str
    problem_set_id: int


@router.post("", response_model=ExtractionResponse)
async def start_extraction(req: ExtractionRequest):
    folder = Path(req.folder_path)
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=400, detail="폴더 경로가 올바르지 않습니다.")

    pdf_files = sorted(folder.glob("*.pdf"))
    if not pdf_files:
        raise HTTPException(status_code=400, detail="PDF 파일이 없습니다.")

    problem_set_name = folder.name

    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO problem_sets (name, source_path) VALUES (?, ?)",
            (problem_set_name, str(folder)),
        )
        problem_set_id = cursor.lastrowid

        chapters = []
        for sort_order, pdf_file in enumerate(pdf_files):
            chapter_name = pdf_file.stem
            cursor = db.execute(
                "INSERT INTO chapters (problem_set_id, name, source_filename, sort_order) VALUES (?, ?, ?, ?)",
                (problem_set_id, chapter_name, pdf_file.name, sort_order),
            )
            chapters.append({
                "id": cursor.lastrowid,
                "name": chapter_name,
                "pdf_path": str(pdf_file),
                "sort_order": sort_order,
            })
        db.commit()

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "running",
        "cancelled": False,
        "problem_set_id": problem_set_id,
        "chapters": chapters,
        "events": asyncio.Queue(),
    }

    asyncio.get_event_loop().create_task(
        _run_extraction(job_id, problem_set_id, chapters)
    )

    return ExtractionResponse(job_id=job_id, problem_set_id=problem_set_id)


async def _run_extraction(
    job_id: str, problem_set_id: int, chapters: list[dict]
) -> None:
    job = _jobs[job_id]
    total_problems = 0

    try:
        for idx, chapter in enumerate(chapters):
            if job["cancelled"]:
                await job["events"].put({
                    "event": "cancelled",
                    "data": '{"type":"cancelled"}',
                })
                return

            await job["events"].put({
                "event": "progress",
                "data": _json_str({
                    "type": "chapter_start",
                    "chapter": chapter["name"],
                    "index": idx,
                    "total_chapters": len(chapters),
                }),
            })

            output_dir = IMAGES_DIR / str(problem_set_id) / str(chapter["id"])
            output_dir.mkdir(parents=True, exist_ok=True)

            chapter_problems = 0

            loop = asyncio.get_event_loop()
            problems_data = await loop.run_in_executor(
                None,
                lambda ch=chapter: list(extract_chapter(ch["pdf_path"], output_dir)),
            )

            with get_db() as db:
                for prob in problems_data:
                    if job["cancelled"]:
                        break

                    image_path = f"{problem_set_id}/{chapter['id']}/{prob['filename']}"
                    db.execute(
                        """INSERT INTO problems
                           (chapter_id, number, image_path, width, height, file_size, page_num, column_pos)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            chapter["id"],
                            prob["number"],
                            image_path,
                            prob["width"],
                            prob["height"],
                            prob["file_size"],
                            prob["page_num"],
                            prob["column_pos"],
                        ),
                    )
                    chapter_problems += 1
                    total_problems += 1

                    if chapter_problems % 5 == 0 or chapter_problems == len(problems_data):
                        await job["events"].put({
                            "event": "progress",
                            "data": _json_str({
                                "type": "problem",
                                "chapter": chapter["name"],
                                "number": prob["number"],
                                "total_so_far": total_problems,
                            }),
                        })

                db.execute(
                    "UPDATE chapters SET total_problems = ? WHERE id = ?",
                    (chapter_problems, chapter["id"]),
                )
                db.commit()

            await job["events"].put({
                "event": "progress",
                "data": _json_str({
                    "type": "chapter_done",
                    "chapter": chapter["name"],
                    "problems": chapter_problems,
                }),
            })

        await job["events"].put({
            "event": "progress",
            "data": _json_str({
                "type": "done",
                "total_problems": total_problems,
                "total_chapters": len(chapters),
            }),
        })
        job["status"] = "done"

    except Exception as e:
        await job["events"].put({
            "event": "progress",
            "data": _json_str({"type": "error", "message": str(e)}),
        })
        job["status"] = "error"


def _json_str(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False)


@router.get("/progress/{job_id}")
async def extraction_progress(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_stream() -> AsyncGenerator:
        job = _jobs[job_id]
        while True:
            try:
                event = await asyncio.wait_for(job["events"].get(), timeout=30.0)
                yield event
                data = json.loads(event["data"])
                if data.get("type") in ("done", "error", "cancelled"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}

    return EventSourceResponse(event_stream())


@router.post("/cancel/{job_id}")
async def cancel_extraction(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    _jobs[job_id]["cancelled"] = True
    return {"status": "cancelling"}
