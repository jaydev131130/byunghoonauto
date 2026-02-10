from pathlib import Path

from backend.config import IMAGES_DIR


def problem_set_dir(problem_set_id: int) -> Path:
    path = IMAGES_DIR / str(problem_set_id)
    path.mkdir(exist_ok=True)
    return path


def chapter_dir(problem_set_id: int, chapter_id: int) -> Path:
    path = problem_set_dir(problem_set_id) / str(chapter_id)
    path.mkdir(exist_ok=True)
    return path


def problem_image_path(
    problem_set_id: int, chapter_id: int, number: int, ext: str = "jpg"
) -> Path:
    return chapter_dir(problem_set_id, chapter_id) / f"{number:03d}.{ext}"
