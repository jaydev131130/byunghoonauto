import shutil
from pathlib import Path

from backend.config import IMAGES_DIR


def _chapter_dir(problem_set_id: int, chapter_id: int) -> Path:
    return IMAGES_DIR / str(problem_set_id) / str(chapter_id)


def save_problem_image(
    problem_set_id: int, chapter_id: int, number: int, image_data: bytes
) -> str:
    directory = _chapter_dir(problem_set_id, chapter_id)
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{number:03d}.jpg"
    filepath = directory / filename
    with open(filepath, "wb") as f:
        f.write(image_data)
    return str(filepath.relative_to(IMAGES_DIR))


def get_image_dir(problem_set_id: int, chapter_id: int) -> Path:
    return _chapter_dir(problem_set_id, chapter_id)


def delete_problem_image(image_path: str) -> None:
    filepath = IMAGES_DIR / image_path
    if filepath.exists():
        filepath.unlink()


def delete_chapter_images(problem_set_id: int, chapter_id: int) -> None:
    directory = _chapter_dir(problem_set_id, chapter_id)
    if directory.exists():
        shutil.rmtree(directory)


def delete_problem_set_images(problem_set_id: int) -> None:
    directory = IMAGES_DIR / str(problem_set_id)
    if directory.exists():
        shutil.rmtree(directory)
