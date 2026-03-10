from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import sqlite3
import unicodedata
import uuid
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend.config import IMAGES_DIR, UPLOADS_DIR, UPLOADS_STAGING_DIR
from backend.database import get_db
from backend.services.extractor import extract_chapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/extract", tags=["extraction"])

_jobs: dict[str, dict] = {}

MAX_FILE_SIZE = 100 * 1024 * 1024      # 100 MB per file
MAX_TOTAL_SIZE = 500 * 1024 * 1024     # 500 MB total
MAX_FILE_COUNT = 50
CHUNK_SIZE = 1024 * 1024               # 1 MB chunks
PDF_MAGIC = b"%PDF"


class ExtractionResponse(BaseModel):
    job_id: str
    problem_set_id: int


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    name = unicodedata.normalize("NFC", name)
    name = re.sub(r"[\x00-\x1f\x7f]", "", name)
    name = name.replace("/", "").replace("\\", "")
    if not name.lower().endswith(".pdf"):
        name = name + ".pdf"
    if len(name) > 200:
        name = name[:-4][:196] + ".pdf"
    if not name or name == ".pdf":
        name = "unnamed.pdf"
    return name


def _unique_name(name: str, seen: set[str]) -> str:
    if name not in seen:
        return name
    stem = name[:-4]
    counter = 1
    while True:
        candidate = f"{stem} ({counter}).pdf"
        if candidate not in seen:
            return candidate
        counter += 1


@router.post("/upload", response_model=ExtractionResponse)
async def upload_and_extract(
    name: str = Form(...),
    files: list[UploadFile] = File(...),
) -> ExtractionResponse:
    # 1. Validate name
    name = unicodedata.normalize("NFC", name).strip()
    if not name or len(name) > 100:
        raise HTTPException(
            status_code=422,
            detail="문제집 이름은 1~100자 사이여야 합니다.",
        )

    # 2. Validate file count
    if len(files) == 0:
        raise HTTPException(status_code=422, detail="PDF 파일이 없습니다.")
    if len(files) > MAX_FILE_COUNT:
        raise HTTPException(
            status_code=422,
            detail=f"파일은 최대 {MAX_FILE_COUNT}개까지 업로드할 수 있습니다.",
        )

    # 3. Validate each file (magic bytes + size)
    total_size = 0
    file_buffers: list[bytes] = []
    for upload in files:
        header = await upload.read(4)
        if header != PDF_MAGIC:
            raise HTTPException(
                status_code=422,
                detail=f"'{upload.filename}'은 유효한 PDF 파일이 아닙니다.",
            )
        await upload.seek(0)
        content = await upload.read()
        file_size = len(content)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=422,
                detail=f"'{upload.filename}' 파일 크기가 100MB를 초과합니다.",
            )
        total_size += file_size
        if total_size > MAX_TOTAL_SIZE:
            raise HTTPException(
                status_code=422,
                detail="전체 업로드 용량이 500MB를 초과합니다.",
            )
        file_buffers.append(content)

    # 4-5. Sanitize and deduplicate filenames
    seen_names: set[str] = set()
    safe_names: list[str] = []
    for upload in files:
        raw = sanitize_filename(upload.filename or "unnamed.pdf")
        unique = _unique_name(raw, seen_names)
        seen_names.add(unique)
        safe_names.append(unique)

    # 6. Create staging directory
    staging_dir = UPLOADS_STAGING_DIR / str(uuid.uuid4())
    staging_dir.mkdir(parents=True, exist_ok=True)

    # 7. Save files to staging in chunks
    try:
        for safe_name, content in zip(safe_names, file_buffers):
            dest = staging_dir / safe_name
            with open(dest, "wb") as fh:
                for offset in range(0, len(content), CHUNK_SIZE):
                    fh.write(content[offset : offset + CHUNK_SIZE])
    except Exception:
        shutil.rmtree(staging_dir, ignore_errors=True)
        logger.exception("Failed to save uploaded files to staging directory")
        raise HTTPException(status_code=500, detail="파일 저장 중 오류가 발생했습니다.")

    # 8-9. DB transaction
    problem_set_id: int | None = None
    try:
        with get_db() as db:
            try:
                cursor = db.execute(
                    "INSERT INTO problem_sets (name, source_path) VALUES (?, ?)",
                    (name, ""),  # source_path updated after staging rename
                )
                problem_set_id = cursor.lastrowid
            except sqlite3.IntegrityError:
                shutil.rmtree(staging_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=409,
                    detail="같은 이름의 문제집이 이미 존재합니다.",
                )

            staging_chapters: list[dict] = []
            for sort_order, safe_name in enumerate(safe_names):
                chapter_name = unicodedata.normalize("NFC", Path(safe_name).stem)
                cursor = db.execute(
                    "INSERT INTO chapters (problem_set_id, name, source_filename, sort_order) VALUES (?, ?, ?, ?)",
                    (problem_set_id, chapter_name, safe_name, sort_order),
                )
                staging_chapters.append({
                    "id": cursor.lastrowid,
                    "name": chapter_name,
                    "pdf_path": str(staging_dir / safe_name),
                    "sort_order": sort_order,
                })

            db.commit()
    except HTTPException:
        raise
    except Exception:
        shutil.rmtree(staging_dir, ignore_errors=True)
        logger.exception("DB error during problem set creation")
        raise HTTPException(status_code=500, detail="데이터베이스 오류가 발생했습니다.")

    # 10. Rename staging → final uploads directory + update source_path
    final_dir = UPLOADS_DIR / str(problem_set_id)
    try:
        staging_dir.rename(final_dir)
        with get_db() as db:
            db.execute(
                "UPDATE problem_sets SET source_path = ? WHERE id = ?",
                (str(final_dir), problem_set_id),
            )
            db.commit()
    except Exception:
        shutil.rmtree(staging_dir, ignore_errors=True)
        logger.exception("Failed to move staging directory to final location")
        raise HTTPException(status_code=500, detail="파일 이동 중 오류가 발생했습니다.")

    # 11. Build chapter dicts with final paths (after rename)
    chapters = [
        {
            "id": ch["id"],
            "name": ch["name"],
            "pdf_path": str(final_dir / safe_names[idx]),
            "sort_order": ch["sort_order"],
        }
        for idx, ch in enumerate(staging_chapters)
    ]

    # 12. Create job and kick off extraction
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "running",
        "cancelled": False,
        "problem_set_id": problem_set_id,
        "chapters": chapters,
        "events": asyncio.Queue(maxsize=200),
    }

    asyncio.create_task(_run_extraction(job_id, problem_set_id, chapters))

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

            loop = asyncio.get_running_loop()
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

    except Exception:
        logger.exception("Extraction job %s failed", job_id)
        await job["events"].put({
            "event": "progress",
            "data": _json_str({"type": "error", "message": "추출 중 오류가 발생했습니다."}),
        })
        job["status"] = "error"

    finally:
        asyncio.create_task(_cleanup_job(job_id))


async def _cleanup_job(job_id: str, delay: int = 300) -> None:
    await asyncio.sleep(delay)
    _jobs.pop(job_id, None)


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
