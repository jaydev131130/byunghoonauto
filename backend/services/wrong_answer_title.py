from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime


_LEGACY_DEFAULT_TITLE_RE = re.compile(
    r"^\s*오답노트(?:\s+\d{4}-\d{1,2}-\d{1,2})?\s*$"
)


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return unicodedata.normalize("NFC", value).strip()


def build_student_label(student_name: str, grade: str | None = None) -> str:
    parts = [_normalize_text(grade), _normalize_text(student_name)]
    return " ".join(part for part in parts if part)


def _coerce_date(value: date | datetime | str | None = None) -> date:
    if value is None:
        return date.today()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    normalized = _normalize_text(value)
    if not normalized:
        return date.today()
    try:
        return datetime.fromisoformat(normalized.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    return date.today()


def format_month_day(value: date | datetime | str | None = None) -> str:
    current = _coerce_date(value)
    return f"{current.month}/{current.day}"


def build_default_title(
    student_name: str,
    grade: str | None = None,
    created_at: date | datetime | str | None = None,
) -> str:
    student_label = build_student_label(student_name, grade)
    base = format_month_day(created_at)
    if not student_label:
        return base
    return f"{base} {student_label}"


def is_legacy_default_title(title: str | None) -> bool:
    normalized = _normalize_text(title)
    if not normalized:
        return True
    return bool(_LEGACY_DEFAULT_TITLE_RE.fullmatch(normalized))


def resolve_wrong_answer_title(
    title: str | None,
    student_name: str,
    grade: str | None = None,
    created_at: date | datetime | str | None = None,
) -> str:
    normalized = _normalize_text(title)
    if is_legacy_default_title(normalized):
        return build_default_title(student_name, grade, created_at)
    return normalized
