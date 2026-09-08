"""Heading *detection*, deliberately separate from *classification* (which
canonical section a heading maps to — see `section_evidence.py` and
`segmentation.py`'s use of both).

No fixed phrase list can ever enumerate every real resume's header wording
("Professional Journey", "Technical Arsenal", "Things I Have Built") — so
classification needs a content-based fallback for a line that reads as a
header by *shape* but doesn't match any known alias. That fallback needs
candidates whose shape was recognized independently of their words, which
is what this module produces.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List

from .extraction.models import Line

_SENTENCE_END_RE = re.compile(r"[.!?]\s*$")
# A date, an email, or a URL is never itself a section heading, however it
# happens to be styled — matches the existing disqualifying check
# `_looks_like_header_format` already used in segmentation.py.
_DISQUALIFYING_RE = re.compile(r"\d{4}|@|http")


@dataclass
class HeadingCandidate:
    line: Line
    visual_score: float  # 0..1 — formatting-only signal, no text-matching at all
    evidence: List[str] = field(default_factory=list)


def score_heading_candidate(line: Line, baseline: float) -> HeadingCandidate:
    """Weighted combination of independent visual signals — not a single
    all-or-nothing gate. A header need not be bold *and* uppercase *and*
    larger than body text all at once; each signal contributes, so e.g. a
    line that's larger but not bold, or bold but not uppercase, still
    registers as a plausible (if weaker) candidate rather than being
    invisible to classification entirely.

    Uppercase carries the most weight of any single signal here — not a
    hard requirement (a very large non-uppercase line can still clear the
    bar on size and boldness alone), but empirically the one signal that
    actually separates a genuine section header from an entry *label* line
    within an already-open section (a job title, a company/institution
    name, a project title). Real fixtures showed those label lines are
    routinely styled just as bold and just as large as a real header —
    "Software Developer Intern" at 12pt bold scores close to "WORK
    EXPERIENCE" at the same 12pt bold — but they're conventionally Title
    Case while section headers are conventionally ALL CAPS, and that held
    across every case seen: every genuine target header was uppercase,
    every false-positive entry label wasn't.
    """
    text = line.text.strip()
    evidence: List[str] = []

    if not text or _DISQUALIFYING_RE.search(text):
        return HeadingCandidate(line=line, visual_score=0.0, evidence=["disqualified: date/email/url-shaped"])

    score = 0.0

    if baseline:
        ratio = line.font_size / baseline
        if ratio >= 1.15:
            score += 0.3
            evidence.append(f"font size {ratio:.2f}x body baseline")
            if ratio >= 1.4:
                score += 0.15
                evidence.append("substantially larger than body text")
        elif ratio >= 1.0 and line.bold:
            score += 0.05
            evidence.append("at-or-above body size and bold")

    if line.bold:
        score += 0.15
        evidence.append("bold")

    letters = [c for c in text if c.isalpha()]
    if letters:
        upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
        if upper_ratio >= 0.9:
            score += 0.35
            evidence.append("mostly uppercase")
        elif upper_ratio >= 0.5:
            score += 0.1
            evidence.append("partly uppercase")

    if len(text) <= 40:
        score += 0.1
        evidence.append("short")
    elif len(text) > 60:
        score -= 0.15
        evidence.append("long — reads more like body prose")

    if _SENTENCE_END_RE.search(text):
        score -= 0.1
        evidence.append("ends like a sentence")
    else:
        score += 0.05

    return HeadingCandidate(line=line, visual_score=max(0.0, min(1.0, score)), evidence=evidence)
