"""Professional experience extraction.

Splits the Experience section body on date-range lines, then walks backward
from each date line to pick up the (up to two) preceding bold "label" lines
as company/title, and forward to collect bullet/continuation lines as the
description — per the pipeline design (`docs/architecture.md`).
"""
from __future__ import annotations

from typing import List, Optional

from ..extraction.models import Line
from .common import (
    body_baseline,
    clean_text,
    is_bullet_line,
    parse_date_range,
    parse_duration,
    parse_lone_date,
    strip_bullet,
)

_SIZE_TIE_EPSILON = 0.75

# Job titles come from a fairly bounded, well-known vocabulary — a far more
# reliable content signal than trying to recognize a company as a named
# entity (an isolated 1-3 word line like "Waegoo" or "Escenems
# Technologies", with no surrounding sentence context, is exactly the case
# general-purpose NER performs worst on). Checked *before* the
# size/boldness heuristics below, since it generalizes across arbitrary
# formatting conventions rather than depending on which one a given resume
# happens to bold or enlarge.
_TITLE_KEYWORDS = (
    "engineer", "developer", "manager", "analyst", "intern", "internship",
    "lead", "director", "specialist", "consultant", "designer", "architect",
    "coordinator", "executive", "officer", "associate", "administrator",
    "scientist", "researcher", "president", "founder", "head of", "vp ",
    "ceo", "cto", "coo", "cfo", "programmer", "technician", "supervisor",
    "strategist", "advisor", "trainee", "assistant", "representative",
)


def _looks_like_title(text: str) -> bool:
    lowered = f" {text.lower()} "
    return any(kw in lowered for kw in _TITLE_KEYWORDS)


def _is_label_line(line: Line, baseline: float) -> bool:
    """A label line is company/title text preceding the date line.

    Not every label line is bold: some resumes bold only the title, at the
    same font size as the plain company line beneath it. A plain line must
    still count as a label if it sits at the section's larger "title tier"
    font size, or it (and the bold title above it) get misread as leftover
    body text belonging to the *previous* entry's description.
    """
    text = clean_text(line.text)
    if not text or is_bullet_line(text):
        return False
    if line.bold:
        return True
    return bool(baseline) and line.font_size > baseline + 0.5


def _split_company_title(label_lines: List[Line]) -> tuple[Optional[str], Optional[str]]:
    texts = [clean_text(l.text) for l in label_lines if clean_text(l.text)]
    if not texts:
        return None, None
    if len(texts) >= 2:
        a, b = label_lines[0], label_lines[1]
        title_match = [_looks_like_title(t) for t in texts[:2]]
        if title_match[0] != title_match[1]:
            # Exactly one line reads as a job title — content beats
            # formatting, since this holds regardless of which one a given
            # resume happens to bold/enlarge.
            title, company = (texts[0], texts[1]) if title_match[0] else (texts[1], texts[0])
            return company, title
        size_gap = a.font_size - b.font_size
        if abs(size_gap) > _SIZE_TIE_EPSILON:
            # A clearly larger label line is the company (resumes render the
            # employer name more prominently than the job title).
            company, title = (texts[0], texts[1]) if size_gap > 0 else (texts[1], texts[0])
        elif a.bold != b.bold:
            # Same size, only one bold: the bold one is the title (the
            # emphasized "headline" of the entry); the plain one is the
            # company.
            title, company = (texts[0], texts[1]) if a.bold else (texts[1], texts[0])
        else:
            # No distinguishing signal — fall back to source order, which is
            # company-first in every fixture observed so far.
            company, title = texts[0], texts[1]
        return company, title
    single = texts[0]
    for sep in (" | ", " - ", " – ", ", "):
        if sep in single:
            parts = [p.strip() for p in single.split(sep, 1)]
            # "Title, Company" ("React Developer, Digiflutters Technologies")
            # is just as common as "Company, Title" — content beats a blind
            # first-part-is-company assumption, same as the two-line case.
            part_is_title = [_looks_like_title(p) for p in parts]
            if part_is_title[0] != part_is_title[1]:
                return (parts[1], parts[0]) if part_is_title[0] else (parts[0], parts[1])
            return parts[0], parts[1]
    return single, None


def _collect_description(body_lines: List[Line]) -> List[str]:
    description: List[str] = []
    for line in body_lines:
        text = clean_text(line.text)
        if not text:
            continue
        if is_bullet_line(text):
            description.append(strip_bullet(text))
        elif description:
            # Continuation of the previous bullet (line-wrap in the source PDF).
            description[-1] = f"{description[-1]} {text}".strip()
        else:
            description.append(text)
    return description


def _collect_label_lines_backward(
    section_lines: List[Line], start: int, lower_bound: int, baseline: float
) -> tuple[List[Line], int]:
    """Walk backward from `start` (exclusive of `lower_bound`) collecting up
    to 2 label lines, strict first (see `_is_label_line`), falling back to
    just taking whatever's immediately there — any non-empty, non-bullet
    line — if the strict pass finds nothing at all.

    The fallback matters because company/title is essentially always
    immediately above a date line by convention; when a source format
    gives *neither* line a distinguishing bold/size signal (e.g. a DOCX
    with no explicit run-level sizing on either line), the strict pass
    correctly finds nothing — but returning null company/title, or bleeding
    those two lines into the *previous* entry's description, is worse than
    just taking them.

    Returns `(label_lines, boundary)` — `boundary` is the index of the
    leftmost consumed line (or `start + 1`, i.e. nothing consumed), so the
    caller can correctly exclude label lines separated from `start` by a
    blank line rather than assuming exactly `len(label_lines)` lines back.
    """
    label_lines: List[Line] = []
    j = start
    boundary = start + 1
    while j > lower_bound and len(label_lines) < 2:
        line = section_lines[j]
        text = clean_text(line.text)
        if not text:
            j -= 1
            continue
        if _is_label_line(line, baseline):
            label_lines.insert(0, line)
            boundary = j
            j -= 1
            continue
        break

    if not label_lines:
        j = start
        boundary = start + 1
        while j > lower_bound and len(label_lines) < 2:
            line = section_lines[j]
            text = clean_text(line.text)
            if not text or is_bullet_line(text):
                break
            label_lines.insert(0, line)
            boundary = j
            j -= 1

    return label_lines, boundary


def _collect_label_lines_forward(
    section_lines: List[Line], start: int, upper_bound: int, baseline: float
) -> tuple[List[Line], int]:
    """Mirror of `_collect_label_lines_backward` for the less common but
    real "date precedes company/title" convention — a date/location column
    to the *left* of each entry, sharing a row with the company/title
    column to its right, rather than the more usual company/title-then-date
    stacking. Walks forward from just after the date line instead of
    backward from just before it. A second label line here (the title,
    right after a bold company line) is sometimes styled identically to
    plain body text in this convention — accepted by title-keyword content
    too, not just the formatting signal, so long as it's short enough to be
    a title rather than the start of a bulleted description.
    """
    label_lines: List[Line] = []
    j = start
    boundary = start
    while j < upper_bound and len(label_lines) < 2:
        line = section_lines[j]
        text = clean_text(line.text)
        if not text:
            j += 1
            continue
        is_label = _is_label_line(line, baseline)
        if not is_label and label_lines and _looks_like_title(text) and len(text) <= 100:
            is_label = True
        if not is_label:
            break
        label_lines.append(line)
        boundary = j + 1
        j += 1
    return label_lines, boundary


def _entry_date(text: str) -> Optional[tuple[Optional[str], Optional[str], bool]]:
    start, end, is_current = parse_date_range(text)
    if start or end:
        return start, end, is_current
    lone = parse_lone_date(text)
    if lone:
        # A bare date with no range/"Present" is, on the resumes seen so
        # far, always the still-current position — the end date is simply
        # left unwritten rather than spelled out.
        return lone, None, True
    duration = parse_duration(text)
    if duration:
        # No date at all, just a duration ("3 Months") — kept as-is in
        # `startDate` since it can't be turned into a real date, which is
        # still far more useful to a reader than dropping the entry.
        return duration, None, False
    return None


def extract_experience(section_lines: List[Line]) -> List[dict]:
    if not section_lines:
        return []

    date_indices = [i for i, l in enumerate(section_lines) if _entry_date(l.text) is not None]

    if not date_indices:
        return []

    baseline = body_baseline(section_lines)
    entries: List[dict] = []
    for entry_num, date_idx in enumerate(date_indices):
        prev_boundary = date_indices[entry_num - 1] if entry_num > 0 else -1
        next_date_idx = date_indices[entry_num + 1] if entry_num + 1 < len(date_indices) else len(section_lines)

        label_lines, _ = _collect_label_lines_backward(section_lines, date_idx - 1, prev_boundary, baseline)
        body_start = date_idx + 1
        if not label_lines:
            # Nothing usable immediately above the date line — try the
            # "date precedes label" convention instead, looking just after
            # it (bounded by the next entry's date, so it can't run past
            # this entry's own content).
            label_lines, body_start = _collect_label_lines_forward(
                section_lines, date_idx + 1, next_date_idx, baseline
            )
        company, title = _split_company_title(label_lines)

        start_date, end_date, is_current = _entry_date(section_lines[date_idx].text)

        # Description runs from just after the label lines to just before
        # the next entry's first label line (or end of section) — found the
        # same way: back up over the next entry's (up to 2) label lines.
        if entry_num + 1 < len(date_indices):
            _, end_boundary = _collect_label_lines_backward(section_lines, next_date_idx - 1, date_idx, baseline)
        else:
            end_boundary = len(section_lines)

        body_lines = section_lines[body_start : end_boundary]
        description = _collect_description(body_lines)

        entries.append(
            {
                "company": company,
                "title": title,
                "startDate": start_date,
                "endDate": end_date,
                "isCurrent": is_current,
                "description": description,
            }
        )

    return entries
