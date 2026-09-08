"""Small shared helpers used by several section extractors."""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

from ..extraction.models import Line

_BULLET_RE = re.compile(r"^[​\s]*[●○•▪◦\-\*]\s*")
_ZERO_WIDTH_RE = re.compile(r"[​‌‍﻿]")

_MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

_MONTH_YEAR_RE = re.compile(
    r"(?P<month>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(?P<year>\d{4})",
    re.IGNORECASE,
)
_NUMERIC_MONTH_YEAR_RE = re.compile(r"\b(?P<month>0?[1-9]|1[0-2])/(?P<year>(?:19|20)\d{2})\b")
_ISO_YEAR_MONTH_RE = re.compile(r"\b(?P<year>(?:19|20)\d{2})-(?P<month>0?[1-9]|1[0-2])\b")
_YEAR_ONLY_RE = re.compile(r"\b(?P<year>(19|20)\d{2})\b")
_PRESENT_RE = re.compile(r"present|current|till date|ongoing", re.IGNORECASE)

# A date token on either side of a range is either a month name + year
# ("Jan 2022"), a numeric "MM/YYYY" ("01/2022"), ISO "YYYY-MM" ("2022-01" —
# a real convention on minimalist/tech-styled templates), or a bare year.
# The ISO form must be tried before the bare-year alternative: alternation
# tries left to right and stops at the first match, so without this order a
# "2023-04" token would match only its leading "2023" and leave "-04"
# dangling, breaking the range separator right after it.
_DATE_TOKEN = (
    r"(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}"
    r"|\d{4}-\d{1,2}"
    r"|\d{1,2}/\d{4}"
    r"|\d{4})"
)

DATE_RANGE_RE = re.compile(
    rf"(?P<start>{_DATE_TOKEN})"
    r"\s*(?:[-–—]|to)\s*"
    rf"(?P<end>{_DATE_TOKEN}|Present|Current|Till Date|Ongoing)",
    re.IGNORECASE,
)


def clean_text(text: str) -> str:
    text = _ZERO_WIDTH_RE.sub("", text)
    return " ".join(text.split()).strip()


def is_bullet_line(text: str) -> bool:
    return bool(_BULLET_RE.match(clean_text(text) or text))


def strip_bullet(text: str) -> str:
    return _BULLET_RE.sub("", clean_text(text)).strip()


def body_baseline(lines: List[Line]) -> float:
    sizes = [l.font_size for l in lines if l.font_size > 0]
    if not sizes:
        return 0.0
    from collections import Counter

    return Counter(round(s, 1) for s in sizes).most_common(1)[0][0]


def is_entry_title_line(line: Line, baseline: float) -> bool:
    """Detects the start of a new project/experience-style entry.

    Three conventions are all common in real resumes and all count:
      (a) a bold line rendered a size or two above the surrounding body
          text (e.g. a project name at 13pt against 11pt body);
      (b) a bold, short, bullet-prefixed line at the *same* size as its
          siblings, distinguished only by boldness (e.g. "● Waypoint
          Protect" as a top-level bullet, with plain, non-bold "○ ..."
          sub-bullets for the tech stack/description underneath it) — a
          tight length cap here guards against mistaking a bold *bulleted
          description sentence* for a title, since both compete for the
          same bold+same-size+bulleted signal;
      (c) a bold, plain (non-bulleted) line at the *same* size as its
          siblings that packs the name, a "- Link", and the tech stack all
          onto one line (e.g. "Samvad AI - Link  Next.js, Prisma, AWS...").
          This isn't competing with bulleted description text for the same
          signal — every description line observed in this convention is
          plain (non-bold) — so it gets a much looser length cap, just
          enough to rule out an accidentally-bold multi-sentence paragraph.
    """
    text = clean_text(line.text)
    if not line.bold or not text:
        return False
    bulleted = is_bullet_line(text)
    stripped = strip_bullet(text) if bulleted else text
    if not stripped:
        return False
    if baseline and line.font_size > baseline + 0.5:
        return True
    if bulleted:
        return len(stripped) <= 70
    return len(stripped) <= 200


def to_iso_month(token: str) -> Optional[str]:
    """Convert a "Mon YYYY", "MM/YYYY", "YYYY-MM", or "YYYY" token to ISO
    "YYYY-MM"/"YYYY" if possible."""
    token = token.strip()
    m = _MONTH_YEAR_RE.search(token)
    if m:
        month = _MONTHS.get(m.group("month").lower()[:3], None) or _MONTHS.get(m.group("month").lower())
        year = m.group("year")
        if month:
            return f"{year}-{month:02d}"
    m = _ISO_YEAR_MONTH_RE.search(token)
    if m:
        return f"{m.group('year')}-{int(m.group('month')):02d}"
    m = _NUMERIC_MONTH_YEAR_RE.search(token)
    if m:
        return f"{m.group('year')}-{int(m.group('month')):02d}"
    y = _YEAR_ONLY_RE.search(token)
    if y:
        return y.group("year")
    return None


def parse_date_range(text: str) -> Tuple[Optional[str], Optional[str], bool]:
    """Parse a date-range string into (startDate, endDate, isCurrent).

    Dates are converted to ISO "YYYY-MM" when confidently parsed, otherwise
    the raw matched text is kept, per the `ParsedExperienceEntry` contract.
    """
    m = DATE_RANGE_RE.search(text)
    if not m:
        return None, None, False
    start_raw = m.group("start").strip()
    end_raw = m.group("end").strip()
    start_iso = to_iso_month(start_raw)
    is_current = bool(_PRESENT_RE.fullmatch(end_raw.strip()))
    if is_current:
        return (start_iso or start_raw), None, True
    end_iso = to_iso_month(end_raw)
    return (start_iso or start_raw), (end_iso or end_raw), False


_LONE_NUMERIC_DATE_RE = re.compile(r"^(?P<month>0?[1-9]|1[0-2])/(?P<year>(?:19|20)\d{2})$")


def parse_lone_date(text: str) -> Optional[str]:
    """A single date with no explicit range (e.g. "01/2024") anchors a
    still-ongoing entry on some resumes — the "Present"/end date is simply
    omitted rather than written out, since it's the current position. Only
    matches when the *entire* line is just the date and nothing else, so a
    date that's merely part of a longer sentence is never mistaken for one
    of these anchors.
    """
    stripped = text.strip()
    m = _LONE_NUMERIC_DATE_RE.match(stripped)
    if m:
        return f"{m.group('year')}-{int(m.group('month')):02d}"
    m = _ISO_YEAR_MONTH_RE.fullmatch(stripped)
    if m:
        return f"{m.group('year')}-{int(m.group('month')):02d}"
    m = _MONTH_YEAR_RE.fullmatch(stripped.rstrip("."))
    if m:
        month = _MONTHS.get(m.group("month").lower()[:3])
        if month:
            return f"{m.group('year')}-{month:02d}"
    return None


_DURATION_RE = re.compile(r"^(?:\d+)\s*(?:day|days|month|months|year|years|yr|yrs)$", re.IGNORECASE)


def parse_duration(text: str) -> Optional[str]:
    """A lone duration string ("3 Months", "15 Days") with no actual date
    at all — some resumes (short-internship-heavy ones especially) record
    only how long a role lasted, never when. Used as a last-resort entry
    anchor when a section has no real date line at all; the raw text is
    kept as-is (it can't be turned into a real date) rather than silently
    dropping the whole entry. Only matches when the *entire* line is just
    the duration, so it can't fire on a duration mentioned mid-sentence.
    """
    stripped = text.strip()
    return stripped if _DURATION_RE.match(stripped) else None


def find_date_range_line_indices(lines: List[Line]) -> List[int]:
    return [i for i, l in enumerate(lines) if DATE_RANGE_RE.search(l.text)]
