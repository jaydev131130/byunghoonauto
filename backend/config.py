from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "app.db"
IMAGES_DIR = DATA_DIR / "images"
PDF_OUTPUT_DIR = DATA_DIR / "pdf_output"

DATA_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)
PDF_OUTPUT_DIR.mkdir(exist_ok=True)
