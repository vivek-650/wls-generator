"""Education section extraction.

Real resumes use several conventions for an entry's 1-2 "label" lines
(bold and/or larger-than-body-text) and detail line(s), e.g.:
  - one bold "Degree – Field" line + a plain "Institution – Year(s)" line
    ("Bachelor of Engineering – Computer Engineering" / "GTU, Ahmedabad –
    2022") — institution+year folded into the detail line;
  - a bold "Institution Name" line + a plain "Degree in Field" detail line
    ("University of Texas at Austin" / "Bachelor of Science in Computer
    Science") — degree lives in the detail line instead;
  - a bold institution-name label line, then a second (often bold,
    smaller) location label line, then a plain degree detail line — two
    label lines, institution supplied directly by a label rather than the
    detail text.

Which label line (if any) is the *degree* vs. the *institution* isn't
reliably positional — sometimes it's the first bold line, sometimes the
second, sometimes neither (it's in the detail text instead) — so it's
decided by content: does a line's text read as a degree name ("Bachelor
of...", "B.Tech", "Diploma", ...) or an institution name ("...University",
"...College", "...Institute", ...)? Only once neither signal fires does it
fall back to position. A location label line that isn't classified as
either has no home in the `ParsedEducationEntry` schema and is
intentionally dropped rather than risk corrupting a real field with it —
mirrors the note in `docs/architecture.md` about warning on soft misses
instead of guessing.
"""
from __future__ import annotations

import re
from typing import List, Optional

from ..extraction.models import Line
from .common import DATE_RANGE_RE, body_baseline, clean_text, is_bullet_line, parse_date_range, parse_lone_date

_YEAR_RE = re.compile(r"(19|20)\d{2}")

_DEGREE_KEYWORDS = (
    "bachelor", "master", "diploma", "associate", "doctor", "phd", "ph.d",
    "b.tech", "btech", "b.e.", " be ", "m.tech", "mtech", "m.e.",
    "b.sc", "bsc", "m.sc", "msc", "bca", "mca", "mba", "b.a.", "m.a.",
    "llb", "l.l.b", "md", "high school", "senior secondary", "secondary",
    "certificate", "post graduate", "undergraduate", "graduate",
)

# Symmetric to _DEGREE_KEYWORDS: a positive signal for "this label line is
# the institution", used when the degree line doesn't otherwise identify
# itself — rather than defaulting to "whichever label line came first",
# which is only correct for one of the two label-order conventions seen so
# far and would misclassify the other.
_INSTITUTION_KEYWORDS = (
    "university", "college", "institute", "school", "academy", "polytechnic",
    "univ.", "u of ", "iit ", "nit ", "vidyalaya", "vidyapeeth",
)


def _contains_keyword(text: str, keywords: tuple) -> bool:
    """Word-boundary keyword match, not a raw substring check — a naive
    `kw in text` let the 3-letter degree keyword "mba" match inside the
    city name "Mu**mba**i" (real bug, hit by a real fixture: "B.Com —
    University of Mumbai" got institution/degree swapped because
    "Mumbai" alone was enough to make the *institution* label look like
    it named an MBA degree). Lookaround instead of `\\b` so a dotted
    keyword like "b.tech" or "ph.d" still matches correctly (the period
    itself already isn't a word character, so `\\b` would work too here,
    but the explicit alnum-boundary check is unambiguous either way).
    """
    lowered = text.lower()
    for kw in keywords:
        kw = kw.strip()
        if kw and re.search(rf"(?<![a-z0-9]){re.escape(kw)}(?![a-z0-9])", lowered):
            return True
    return False


def _looks_like_degree(text: str) -> bool:
    return _contains_keyword(text, _DEGREE_KEYWORDS)


def _looks_like_institution(text: str) -> bool:
    return _contains_keyword(text, _INSTITUTION_KEYWORDS)


def _split_degree_field(text: str) -> tuple[Optional[str], Optional[str]]:
    for sep in (" – ", " — ", " - ", ":", " in "):
        if sep in text:
            a, b = text.split(sep, 1)
            return clean_text(a) or None, clean_text(b) or None
    return clean_text(text) or None, None


_SCORE_OR_DATE_RE = re.compile(r"\bcgpa\b|\bgpa\b|%", re.IGNORECASE)


def _looks_like_score_or_date_line(text: str) -> bool:
    """A duration/CGPA/percentage line (e.g. "2022 – 2026 | CGPA: 8.17",
    "March 2022 | 55.53%") is sometimes bolded by the same template style
    as a real degree/institution label line — but it's never itself a new
    entry's label, so it must not be treated as one even when bold."""
    return bool(DATE_RANGE_RE.search(text) or _SCORE_OR_DATE_RE.search(text))


def _is_label_line(line: Line, baseline: float) -> bool:
    text = clean_text(line.text)
    if not text or is_bullet_line(text) or _looks_like_score_or_date_line(text):
        return False
    if line.bold:
        return True
    return bool(baseline) and line.font_size > baseline + 0.5


_EMBEDDED_NUMERIC_DATE_RE = re.compile(r"\b(0?[1-9]|1[0-2])/((?:19|20)\d{2})\b")


def _extract_dates(detail_text: str) -> tuple[Optional[str], Optional[str]]:
    start, end, _ = parse_date_range(detail_text)
    if start or end:
        return start, end
    m = _EMBEDDED_NUMERIC_DATE_RE.search(detail_text)
    if m:
        # A lone completion date (e.g. "06/2024") with no range at all is
        # always the graduation/end date, never a start.
        return None, f"{m.group(2)}-{int(m.group(1)):02d}"
    year_strs = [m.group(0) for m in _YEAR_RE.finditer(detail_text)]
    if not year_strs:
        return None, None
    start_date = year_strs[0] if len(year_strs) > 1 else None
    end_date = year_strs[-1]
    return start_date, end_date


def _strip_date_range(text: str) -> str:
    m = DATE_RANGE_RE.search(text)
    if m:
        text = (text[: m.start()] + text[m.end() :]).strip(" ,-–—")
    return _EMBEDDED_NUMERIC_DATE_RE.sub("", text).strip(" ,-–—")


def _institution_and_dates_from_detail(
    detail_text: str,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Convention (a): institution and year(s) folded into one detail line,
    e.g. "GTU, Ahmedabad – 2022" — everything before the trailing year(s)
    is the institution."""
    year_strs = [m.group(0) for m in _YEAR_RE.finditer(detail_text)]
    institution = detail_text
    if year_strs:
        # Strip a trailing date (an optional month name before the year, e.g.
        # "March 2022 | 55.53%") through to the end of the line — not just
        # the bare year — so a lone graduation-month word isn't left behind
        # masquerading as the institution name.
        institution = re.sub(
            r"[\s,–—-]*\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?"
            r"(19|20)\d{2}\b.*$",
            "",
            detail_text,
            flags=re.IGNORECASE,
        ).strip()
    institution = institution or None
    start_date = year_strs[0] if len(year_strs) > 1 else None
    end_date = year_strs[-1] if year_strs else None
    return institution, start_date, end_date


_TRAILING_PAREN_DATE_RE = re.compile(r"\(\s*(?P<range>[^()]*?(?:19|20)\d{2}[^()]*)\)\s*$")


def _extract_single_line_entries(section_lines: List[Line]) -> List[dict]:
    """Fallback for a section with *zero* formatting distinction between a
    label line and body text — every line the same size, none bold — so
    the strict scan above never finds anywhere to start an entry at all
    (it requires that distinction). Only ever called when the strict pass
    returned zero entries, so it can never regress a resume that already
    works via real formatting; treats every non-empty line as one
    self-contained entry instead, e.g. "Diploma in User Experience Design
    — National Institute of Design (2020-2021)" — content-classified with
    the same `_looks_like_degree`/`_looks_like_institution` signals a real
    label line would be, with a trailing "(...)" pulled off as the date
    range first.
    """
    entries: List[dict] = []
    for line in section_lines:
        text = clean_text(line.text)
        if not text or is_bullet_line(text):
            continue

        start_date: Optional[str] = None
        end_date: Optional[str] = None
        m = _TRAILING_PAREN_DATE_RE.search(text)
        if m:
            text = text[: m.start()].strip()
            start_date, end_date = _extract_dates(m.group("range"))

        parts = [text]
        for sep in (" – ", " — ", " - "):
            if sep in text:
                parts = [clean_text(p) for p in text.split(sep, 1)]
                break

        degree_idx = next((idx for idx, p in enumerate(parts) if _looks_like_degree(p)), None)
        institution_idx = None
        if degree_idx is None:
            institution_idx = next((idx for idx, p in enumerate(parts) if _looks_like_institution(p)), None)

        if degree_idx is not None:
            degree, field = _split_degree_field(parts[degree_idx])
            other = [p for idx, p in enumerate(parts) if idx != degree_idx]
            institution = other[0] if other else None
        elif institution_idx is not None:
            institution = parts[institution_idx]
            other = [p for idx, p in enumerate(parts) if idx != institution_idx]
            degree, field = _split_degree_field(other[0]) if other else (None, None)
        elif len(parts) >= 2:
            # Neither side reads as either — same source-order default the
            # strict path's own equivalent case falls back to.
            institution = parts[0]
            degree, field = _split_degree_field(parts[1])
        else:
            degree, field = _split_degree_field(parts[0])
            institution = None

        entries.append(
            {
                "institution": institution,
                "degree": degree,
                "field": field,
                "startDate": start_date,
                "endDate": end_date,
            }
        )
    return entries


def extract_education(section_lines: List[Line]) -> List[dict]:
    if not section_lines:
        return []

    baseline = body_baseline(section_lines)
    entries: List[dict] = []
    i = 0
    n = len(section_lines)
    while i < n:
        line = section_lines[i]
        text = clean_text(line.text)
        if not text or is_bullet_line(text):
            i += 1
            continue
        if not _is_label_line(line, baseline):
            # Stray detail line with no preceding label line — skip.
            i += 1
            continue

        label_lines: List[Line] = [line]
        i += 1
        while i < n and len(label_lines) < 2 and _is_label_line(section_lines[i], baseline):
            label_lines.append(section_lines[i])
            i += 1

        detail_texts: List[str] = []
        in_bullet_run = False
        while i < n and not _is_label_line(section_lines[i], baseline) and clean_text(section_lines[i].text):
            detail = clean_text(section_lines[i].text)
            # A bulleted sub-line under an education entry (some templates
            # add a one-line description, e.g. "• Ranked 3rd in class") has
            # no home in this schema — folding it into institution/degree
            # text corrupts a real field, so it's dropped, matching how an
            # unrecognized second label line is already handled below. A
            # long bullet often wraps onto a further plain (non-bulleted)
            # line in the source PDF — that wrapped continuation belongs to
            # the same dropped description, not to institution/degree text,
            # so once a bullet's been seen, plain lines are dropped too
            # until the next real (bulleted or label) line.
            if is_bullet_line(detail):
                in_bullet_run = True
            elif not in_bullet_run:
                detail_texts.append(detail)
            i += 1
        detail_text = " ".join(detail_texts)

        # Classify by content, uniformly regardless of whether there are 1
        # or 2 label lines: whichever label line reads as a degree name
        # wins that role (checked first, since degree vocabulary is the
        # more distinctive/less ambiguous of the two keyword lists); else
        # whichever reads as an institution wins that role instead — e.g. a
        # single bold "University of Texas at Austin" label line must not
        # be assumed to be the degree just because a *different* real
        # resume happens to bold its degree line instead. Only once neither
        # signal fires does it fall back to position (single label = degree,
        # by far the more common convention when a line is unclassifiable;
        # first of two labels = institution).
        label_texts = [clean_text(l.text) for l in label_lines]
        # A right-aligned completion date sharing a row with the
        # institution line (e.g. "C.K. Municipal Commerce and Arts
        # College" / "06/2024") fills the same "label line" slot as a real
        # second label — the *count* of label lines still needs to reflect
        # that slot being filled, or a row that would otherwise trigger the
        # 2-label convention below gets misread as the 1-label one. So a
        # date stays counted in `label_texts`, but is set aside from
        # `non_date_texts` before degree/institution classification (it
        # never reads as either anyway) and its value is kept via
        # `label_date` rather than silently dropped as an "other" label.
        label_date = next((d for t in label_texts if (d := parse_lone_date(t))), None)
        non_date_texts = [t for t in label_texts if not parse_lone_date(t)]

        degree_idx = next((idx for idx, t in enumerate(label_texts) if _looks_like_degree(t)), None)
        institution_idx = None
        if degree_idx is None:
            institution_idx = next(
                (idx for idx, t in enumerate(label_texts) if _looks_like_institution(t)), None
            )

        if degree_idx is not None:
            degree, field = _split_degree_field(label_texts[degree_idx])
            other = [t for idx, t in enumerate(label_texts) if idx != degree_idx and not parse_lone_date(t)]
            if other:
                # The other label line supplies the institution directly.
                institution = other[0]
                start_date, end_date = _extract_dates(detail_text)
            else:
                # No second label line — institution (+ year) comes from
                # the detail line instead, e.g. "GTU, Ahmedabad – 2022".
                institution, start_date, end_date = _institution_and_dates_from_detail(detail_text)
        elif institution_idx is not None:
            institution = label_texts[institution_idx]
            # Any *other* label line here (e.g. a location line, in the
            # two-label convention) isn't a degree and has no home in this
            # schema — dropped rather than risk corrupting a real field.
            degree_field_text = _strip_date_range(detail_text)
            degree, field = _split_degree_field(degree_field_text) if degree_field_text else (None, None)
            start_date, end_date = _extract_dates(detail_text)
        elif len(label_texts) >= 2:
            # Neither keyword list matched either label line — fall back to
            # the original two-label convention's default order.
            institution = non_date_texts[0] if non_date_texts else label_texts[0]
            degree_field_text = _strip_date_range(detail_text)
            degree, field = _split_degree_field(degree_field_text) if degree_field_text else (None, None)
            start_date, end_date = _extract_dates(detail_text)
        else:
            # Neither matched and there's only one label line — assume
            # degree, the far more common single-bold-line convention.
            degree, field = _split_degree_field(non_date_texts[0] if non_date_texts else label_texts[0])
            institution, start_date, end_date = _institution_and_dates_from_detail(detail_text)

        end_date = end_date or label_date

        entries.append(
            {
                "institution": institution,
                "degree": degree,
                "field": field,
                "startDate": start_date,
                "endDate": end_date,
            }
        )

    if not entries:
        return _extract_single_line_entries(section_lines)

    return entries
