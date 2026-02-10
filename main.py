import webbrowser
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import IMAGES_DIR
from backend.database import init_db
from backend.routers import (
    extraction,
    problem_sets,
    chapters,
    problems,
    students,
    wrong_answers,
    pdf_generate,
    creation_history,
)

app = FastAPI(title="Wrong Answer Builder", version="0.1.0")

FRONTEND_DIST = Path(__file__).resolve().parent / "frontend" / "dist"


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ---------------------------------------------------------------------------
# Router registrations
# ---------------------------------------------------------------------------

app.include_router(extraction.router)
app.include_router(problem_sets.router)
app.include_router(chapters.router)
app.include_router(problems.router)
app.include_router(students.router)
app.include_router(wrong_answers.router)
app.include_router(pdf_generate.router)
app.include_router(creation_history.router)


# ---------------------------------------------------------------------------
# Static file mounts
# ---------------------------------------------------------------------------

app.mount("/api/images", StaticFiles(directory=str(IMAGES_DIR)), name="api_images")
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

if FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="assets",
    )


# ---------------------------------------------------------------------------
# SPA fallback — serve index.html for any non-API route
# ---------------------------------------------------------------------------

@app.get("/{full_path:path}")
async def spa_fallback(request: Request, full_path: str) -> FileResponse:
    if full_path.startswith("api"):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))

    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        "Frontend not built. Run: cd frontend && npm run build",
        status_code=503,
    )


def main() -> None:
    host = "127.0.0.1"
    port = 8000
    webbrowser.open(f"http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)


if __name__ == "__main__":
    main()
