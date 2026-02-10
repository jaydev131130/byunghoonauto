import sqlite3
from contextlib import contextmanager
from typing import Generator

from backend.config import DB_PATH

_TABLES_SQL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS problem_sets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    source_path TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chapters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_set_id  INTEGER NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    source_filename TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    total_problems  INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(problem_set_id, name)
);

CREATE TABLE IF NOT EXISTS problems (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id  INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    number      INTEGER NOT NULL,
    image_path  TEXT NOT NULL,
    width       INTEGER NOT NULL,
    height      INTEGER NOT NULL,
    file_size   INTEGER NOT NULL DEFAULT 0,
    page_num    INTEGER,
    column_pos  TEXT,
    UNIQUE(chapter_id, number)
);

CREATE TABLE IF NOT EXISTS students (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    grade       TEXT,
    class_name  TEXT,
    contact     TEXT,
    memo        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wrong_answer_sets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wrong_answers (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    wrong_answer_set_id INTEGER NOT NULL REFERENCES wrong_answer_sets(id) ON DELETE CASCADE,
    chapter_id          INTEGER NOT NULL REFERENCES chapters(id),
    problem_numbers     TEXT NOT NULL,
    UNIQUE(wrong_answer_set_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creation_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    problem_set_id  INTEGER NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
    input_data      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def _create_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = _create_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    conn = _create_connection()
    try:
        conn.executescript(_TABLES_SQL)
        conn.commit()
    finally:
        conn.close()
