"""PDF generation API endpoints."""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException
from starlette.responses import FileResponse

from backend.config import PDF_OUTPUT_DIR
from backend.models import PdfBatchRequest, PdfGenerateRequest, PdfResponse
from backend.services.pdf_generator import generate_batch_pdf, generate_wrong_answer_pdf

logger = logging.getLogger(__name__)

router = APIRouter(tags=["pdf"])

_SAFE_FILENAME = re.compile(r"^[\w\-]+\.pdf$")


@router.post("/api/pdf/generate")
async def generate_pdf(body: PdfGenerateRequest) -> PdfResponse:
    """Generate PDF for a single wrong answer set."""
    try:
        filename = generate_wrong_answer_pdf(
            wrong_answer_set_id=body.wrong_answer_set_id,
            spacer_ratio=body.spacer_ratio,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("PDF generation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="PDF 생성에 실패했습니다."
        ) from exc

    return PdfResponse(
        filename=filename,
        download_url=f"/api/pdf/download/{filename}",
    )


@router.post("/api/pdf/batch")
async def generate_batch(body: PdfBatchRequest) -> PdfResponse:
    """Generate batch PDF for multiple students."""
    if not body.wrong_answer_set_ids:
        raise HTTPException(
            status_code=422, detail="하나 이상의 오답노트를 선택해주세요."
        )

    try:
        filename = generate_batch_pdf(
            wrong_answer_set_ids=body.wrong_answer_set_ids,
            spacer_ratio=body.spacer_ratio,
            include_dividers=body.include_dividers,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Batch PDF generation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="일괄 PDF 생성에 실패했습니다."
        ) from exc

    return PdfResponse(
        filename=filename,
        download_url=f"/api/pdf/download/{filename}",
    )


@router.get("/api/pdf/download/{filename}")
async def download_pdf(filename: str) -> FileResponse:
    """Download a generated PDF file."""
    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    filepath = PDF_OUTPUT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    return FileResponse(
        path=str(filepath),
        media_type="application/pdf",
        filename=filename,
    )
