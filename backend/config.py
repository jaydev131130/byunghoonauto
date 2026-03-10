import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("BYUNGHOON_APP_DATA_DIR", BASE_DIR / "data")).resolve()
DB_PATH = DATA_DIR / "app.db"
IMAGES_DIR = DATA_DIR / "images"
PDF_OUTPUT_DIR = DATA_DIR / "pdf_output"
UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_STAGING_DIR = UPLOADS_DIR / "_staging"

DATA_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
PDF_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_STAGING_DIR.mkdir(parents=True, exist_ok=True)
