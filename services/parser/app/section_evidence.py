"""Content-evidence scoring: what does a block of lines actually *contain*,
independent of any header text above it?

Used as a fallback in `segmentation.py`, only when a visually
header-shaped line (see `segmentation_heading.py`) doesn't match any known
alias — the deterministic, self-hosted, zero-cost answer to "what section
is 'Professional Journey' or 'Technical Arsenal'": don't guess from the
words, look at what's actually inside it (date ranges + job titles ⇒
Experience; degree + institution vocabulary ⇒ Education; and so on).

Deliberately reuses each extractor's own vocabulary (job-title keywords,
degree/institution keywords, the skills taxonomy via a caller-supplied
`SkillMatcher`) rather than duplicating it — this is a second *use* of the
extractors' existing domain knowledge, not a second, drifting copy of it.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

from .extraction.models import Line
from .extractors.common import clean_text, is_bullet_line, parse_date_range, parse_duration, parse_lone_date
from .extractors.education import _DEGREE_KEYWORDS, _INSTITUTION_KEYWORDS, _contains_keyword
from .extractors.experience import _TITLE_KEYWORDS as _JOB_TITLE_KEYWORDS
from .extractors.skills import SkillMatcher

_CANONICAL_SECTIONS = ("experience", "education", "skills", "projects", "certifications", "summary")

# Deliberately *not* `is_bullet_line` (which also treats a bare "-" as a
# bullet, correctly, for the extractors that already know they're looking
# at an actual list) — here a bare hyphen is exactly as likely to be an
# ordinary text/URL separator (a contact line reading "- linkedin.com/...
# - github.com/...", say) as a real bulleted description, and that
# ambiguity once inflated a contact block's Projects score enough to
# misclassify the candidate's own name as a "Projects" header. Structural
# evidence here only counts an unambiguous bullet glyph.
_STRONG_BULLET_RE = re.compile(r"^[​\s]*[●○•▪◦]\s*")


def _is_strong_bullet(text: str) -> bool:
    return bool(_STRONG_BULLET_RE.match(text))


_URL_RE = re.compile(r"https?://|github\.com|gitlab\.com|\bwww\.", re.IGNORECASE)
_CERT_VOCAB_RE = re.compile(r"\bcertifi|\bcredential|\blicens|\bissued by\b|\bissuer\b", re.IGNORECASE)
_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def score_section_content(
    lines: List[Line], skill_matcher: Optional[SkillMatcher] = None
) -> Dict[str, float]:
    """Returns a 0..1 plausibility score per canonical section for this
    block of lines. Every signal is a simple, explainable count over the
    block — no embeddings, no external calls.
    """
    texts = [clean_text(l.text) for l in lines if clean_text(l.text)]
    if not texts:
        return {name: 0.0 for name in _CANONICAL_SECTIONS}

    n = len(texts)
    joined = " ".join(texts)

    date_hits = sum(
        1
        for t in texts
        if parse_date_range(t) != (None, None, False) or parse_lone_date(t) or parse_duration(t)
    )
    title_hits = sum(1 for t in texts if _contains_keyword(t, _JOB_TITLE_KEYWORDS))
    bullet_ratio = sum(1 for t in texts if _is_strong_bullet(t)) / n
    if date_hits > 0 or bullet_ratio > 0.2:
        experience = min(1.0, (date_hits / n) * 1.5 + (title_hits / n) * 0.8 + bullet_ratio * 0.3)
    else:
        # A job-title *word* with no date range and no bulleted
        # descriptions anywhere in the block is weak evidence on its own —
        # an ordinary summary paragraph describing the person almost
        # always names their own role ("...platform engineer building...")
        # without being an Experience entry at all. Real entries in this
        # dataset always carry at least a date or a bullet alongside the
        # title; prose that only has the word doesn't.
        experience = min(1.0, (title_hits / n) * 0.2)

    degree_hits = sum(1 for t in texts if _contains_keyword(t, _DEGREE_KEYWORDS))
    institution_hits = sum(1 for t in texts if _contains_keyword(t, _INSTITUTION_KEYWORDS))
    year_hits = sum(1 for t in texts if _YEAR_RE.search(t))
    education = min(1.0, (degree_hits / n) * 1.2 + (institution_hits / n) * 1.2 + (year_hits / n) * 0.3)

    url_hits = sum(1 for t in texts if _URL_RE.search(t))
    projects = min(1.0, (url_hits / n) * 1.2 + bullet_ratio * 0.4)

    cert_hits = sum(1 for t in texts if _CERT_VOCAB_RE.search(t))
    certifications = min(1.0, (cert_hits / n) * 1.5 + (year_hits / n) * 0.2)

    comma_lines = sum(1 for t in texts if t.count(",") >= 2)
    skill_hits = len(skill_matcher.match(joined)) if skill_matcher is not None else 0
    # A taxonomy hit only counts as strong evidence when the block is
    # actually *list-shaped* — short comma-separated items ("Linux, AWS,
    # Azure, Terraform..."). A well-written summary paragraph routinely
    # names real technologies in a full sentence too ("...building
    # reliable CI/CD systems..."), and without this gate that alone
    # outscored genuine summary evidence on a real fixture, misclassifying
    # a prose paragraph as a Skills section. Average comma-segment length
    # is what actually distinguishes a list ("Docker", "AWS" — a handful
    # of characters each) from prose (a clause, dozens of characters) —
    # but the average alone is gameable two different ways, both hit on
    # real fixtures. First: a wrapped continuation line with no comma at
    # all ("integrations.") still contributes one short "segment" (itself,
    # whole) that dilutes the average enough to hide a single genuinely
    # long clause elsewhere in the block. Second: an unrelated line with
    # just *one* incidental comma (a "City, Country" date/location line —
    # "2023-06 – Present · Noida, India") splits into two short segments
    # that, aggregated across a couple of such lines, look list-shaped on
    # their own even though neither line is a skills list at all. Three
    # guards close both: only draw segments from lines that are
    # *themselves* already a plausible list on their own (>=2 commas, the
    # same bar `comma_lines` already uses — a single incidental comma
    # doesn't qualify a line by itself), and cap the *longest* segment,
    # not just the average — a real list practically never has one 60-char
    # item sitting among a run of 5-10 char ones.
    comma_bearing_texts = [t for t in texts if t.count(",") >= 2]
    comma_items = [seg.strip() for t in comma_bearing_texts for seg in t.split(",") if seg.strip()]
    avg_item_len = (sum(len(s) for s in comma_items) / len(comma_items)) if comma_items else 999.0
    max_item_len = max((len(s) for s in comma_items), default=999)
    list_shaped = len(comma_items) >= 3 and avg_item_len <= 25 and max_item_len <= 40
    if list_shaped:
        skills = min(1.0, (comma_lines / n) * 0.6 + min(skill_hits / n, 1.0) * 0.8)
    else:
        # Prose mentioning real technology names is still weak positive
        # evidence (a Skills section is *more* likely than, say,
        # Certifications to read this way) — just not nearly as strong as
        # an actual list.
        skills = min(1.0, min(skill_hits / n, 1.0) * 0.3)

    # A long comma-separated list line ("Linux, AWS, Azure, Terraform,
    # Kubernetes, Docker, GitHub Actions, Jenkins, Prometheus, Grafana,
    # Python, Bash") is long in raw character count but is *not* prose —
    # without excluding list-shaped lines here too, exactly this kind of
    # line outscored the block's own Skills evidence on "prose length"
    # alone. Reuses the same per-line comma-segment-length check as the
    # block-level list_shaped signal above, just applied line by line.
    def _is_list_shaped_line(t: str) -> bool:
        if "," not in t:
            return False
        segs = [s.strip() for s in t.split(",") if s.strip()]
        if len(segs) < 3:
            return False
        return (sum(len(s) for s in segs) / len(segs)) <= 25 and max(len(s) for s in segs) <= 40

    prose_lines = sum(
        1 for t in texts if len(t) > 60 and not is_bullet_line(t) and not _is_list_shaped_line(t)
    )
    # Everything that makes a block look *structured* (dated entries,
    # degree/institution mentions, links, certification wording) is
    # evidence *against* it being a plain narrative summary paragraph.
    # Deliberately excludes title_hits: a summary paragraph naming the
    # person's own role in a sentence ("...platform engineer building...")
    # is not "structure" the way an actual dated entry is — see the same
    # reasoning on the Experience score above.
    structure_density = (date_hits + degree_hits + institution_hits + url_hits + cert_hits) / n
    summary = max(0.0, min(1.0, (prose_lines / n) * 0.9 - structure_density * 0.6))

    return {
        "experience": experience,
        "education": education,
        "skills": skills,
        "projects": projects,
        "certifications": certifications,
        "summary": summary,
    }


# How confident the *best* score must be before a content-classified
# section is trusted at all — a plain body paragraph under an
# unrecognized bold line must not become a fake section just because
# *something* scored highest among otherwise near-zero scores.
_MIN_CONFIDENCE = 0.35

# The winner must also clearly *beat* the runner-up, not just clear the
# absolute bar above — a short, genuinely ambiguous block (e.g. one degree
# word plus one date, which reads almost equally as "studied X in Y" or
# "worked at X in Y") can tie or nearly tie between two categories. Without
# this, a real fixture's bold institution-name label ("BKNMU UNIVERSITY")
# sitting right after a normal, already-recognized "EDUCATION" header got
# treated as a brand-new pending heading candidate, and its own tiny
# content block (just a degree line + a date line) scored an exact tie
# between Experience and Education — Python's `max()` silently broke the
# tie toward whichever key came first, hijacking real education content
# into a bogus new "Experience" section. When it's genuinely this close,
# the safer answer is "don't classify at all" (falls back to ordinary body
# text of whatever section is already open), not a coin flip.
_MIN_MARGIN = 0.15


def classify_by_content(lines: List[Line], skill_matcher: Optional[SkillMatcher] = None) -> Optional[str]:
    texts = [clean_text(l.text) for l in lines if clean_text(l.text)]

    # A genuine section body never legitimately contains the candidate's
    # own email address — that's uniquely contact-block content in every
    # convention this codebase handles. A short contact line ("Noida,
    # Uttar Pradesh, India | name@example.com | +91 ...") sitting right
    # after the candidate's name/tagline is exactly the case a tiny
    # 1-2-line content block is most statistically vulnerable to: its
    # address commas read as a comma-separated skills list, a portfolio
    # URL reads as a project link — real fixtures got their entire contact
    # block (email/phone/location) wiped out this way, twice, before this
    # guard existed. Refusing to classify a block containing an email
    # closes that off directly rather than chasing each spurious score
    # combination individually.
    if any("@" in t for t in texts):
        return None

    scores = score_section_content(lines, skill_matcher)
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best_name, best_score = ranked[0]
    runner_up_score = ranked[1][1] if len(ranked) > 1 else 0.0
    if best_score < _MIN_CONFIDENCE:
        return None
    if best_score - runner_up_score < _MIN_MARGIN:
        return None
    return best_name
