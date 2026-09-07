"""Professional summary extraction: just the cleaned paragraph text of the
Summary section."""
from __future__ import annotations

from typing import List, Optional

from ..extraction.models import Line
from .common import clean_text


def extract_summary(summary_lines: List[Line]) -> Optional[str]:
    text = " ".join(clean_text(l.text) for l in summary_lines if l.text.strip())
    text = clean_text(text)
    return text or None


def extract_implicit_summary(contact_lines: List[Line], contact: dict) -> Optional[str]:
    """Some resumes place a short objective/profile paragraph directly under
    the name/contact block with no "Summary"/"Objective" header at all —
    since that text lives in the pre-header contact block, it would
    otherwise be silently discarded entirely. Any contact-block line that
    isn't the already-extracted name/location and doesn't carry
    contact-info-shaped content (an email, a phone/date's worth of digits)
    is prose; if there's a meaningful amount of it, it's the summary.
    """
    name = contact.get("fullName") or ""
    location = contact.get("location") or ""
    prose: List[str] = []
    for l in contact_lines:
        text = clean_text(l.text)
        if not text or text == name or text == location:
            continue
        if "@" in text:
            continue
        if sum(ch.isdigit() for ch in text) >= 3:
            continue
        if len(text) < 25:
            continue
        prose.append(text)
    joined = clean_text(" ".join(prose))
    return joined or None
