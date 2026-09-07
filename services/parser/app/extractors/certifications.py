"""Certifications section extraction.

Typical convention: one certification per line (or bold name line + plain
issuer/date line), e.g. "AWS Certified Developer – Associate, Amazon Web
Services, 2023". We split each logical entry on common separators to pull
out issuer/date when present, but always keep at least a `name`.
"""
from __future__ import annotations

import re
from typing import List, Optional

from ..extraction.models import Line
from .common import clean_text, is_bullet_line, strip_bullet

_YEAR_RE = re.compile(r"(19|20)\d{2}")


def _parse_entry(text: str) -> dict:
    parts = [clean_text(p) for p in re.split(r"[,–—|]", text) if clean_text(p)]
    if not parts:
        return {"name": text, "issuer": None, "date": None}

    date = None
    for p in list(parts):
        if _YEAR_RE.fullmatch(p.strip()):
            date = p.strip()
            parts.remove(p)
            break

    name = parts[0] if parts else text
    issuer = parts[1] if len(parts) > 1 else None
    return {"name": name, "issuer": issuer, "date": date}


def extract_certifications(section_lines: List[Line]) -> List[dict]:
    """One certification per line, *unless* a name itself wraps across two
    PDF lines with no other signal to tell (e.g. a narrow sidebar column
    breaking "Diploma in Digital Marketing (Tops" / "Technologies)" mid
    parenthetical) — tracked via simple open/close paren balance, since an
    unclosed "(" at the end of a line is an unambiguous sign the next line
    is its continuation, not a new entry.
    """
    entries: List[dict] = []
    current_text = ""
    open_parens = 0

    def flush() -> None:
        nonlocal current_text
        if current_text:
            entries.append(_parse_entry(current_text))
        current_text = ""

    for line in section_lines:
        text = clean_text(line.text)
        if not text:
            continue
        if is_bullet_line(text):
            text = strip_bullet(text)
        if open_parens > 0:
            current_text = f"{current_text} {text}".strip()
        else:
            flush()
            current_text = text
        open_parens = max(0, open_parens + text.count("(") - text.count(")"))

    flush()
    return entries
