"""Section segmentation: classify each `Line` as a header or body line, then
group the document into an ordered list of (section_name, [Line, ...]).

Header detection uses two signals, either of which is enough:
  (a) fuzzy/case-insensitive match against a known header keyword list, or
  (b) font size/weight materially larger than the surrounding body text.

Everything before the first detected header is the "contact block". Anything
from a "Declaration" header onward is dropped entirely (signature block, not
resume content).
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple

from .extraction.models import Line
from .extractors.skills import SkillMatcher
from .layout import resolve_reading_order
from .section_evidence import classify_by_content
from .segmentation_heading import score_heading_candidate

CONTACT_BLOCK = "__contact__"
DROPPED = "__dropped__"

# How visually header-shaped a line must be before it's even worth trying
# to content-classify. Real resumes routinely style an entry *label* line
# (a job title, a company/institution name) with the same weight/size as
# a genuine section header — "Software Developer Intern" at 12pt bold
# scores only marginally lower than "WORK EXPERIENCE" at the same 12pt
# bold on a real fixture, and the candidate's own name (huge font, no
# other structure yet) does too. Both got wrongly promoted to phantom
# headers at a lower threshold, silently deleting the entry-label text
# from the section body the real extractor needed to see it in. What
# reliably separates them in practice is that a genuine header is
# overwhelmingly styled ALL CAPS while an entry-label line usually isn't —
# so this bar sits high enough that bold+upsized alone (no uppercase)
# rarely clears it, while an uppercase header comfortably does; it's a
# threshold tuned against real regressions, not a hard "must be uppercase"
# rule (see segmentation_heading.py — uppercase is still just one
# contributing signal, never a hard requirement).
_MIN_VISUAL_SCORE = 0.7

# Canonical section name -> accepted header phrasings (lowercase). This list
# is deliberately broad — real resumes phrase the same section a dozen
# different ways, and a header that fails to match falls through as ordinary
# body text of whatever section preceded it, silently corrupting extraction.
# Sections without a dedicated extractor yet (awards, languages, interests,
# volunteer work, publications, references) are still listed so they at
# least get segmented *out* rather than bleeding into a real section.
_HEADER_ALIASES: Dict[str, List[str]] = {
    "summary": [
        "professional summary", "summary", "profile", "professional profile",
        "objective", "career objective", "about me", "about", "overview",
        "executive summary", "personal summary", "personal statement",
    ],
    "skills": [
        "skills", "technical skills", "core competencies", "key skills",
        "competencies", "areas of expertise", "expertise", "skill set",
        "skills & tools", "skills and tools", "technical proficiencies",
        "proficiencies", "tech stack", "tools", "tools & technologies",
        "tools and technologies", "soft skills", "personal skills",
        "interpersonal skills", "soft skills & personality", "core skills",
        "technology stack", "toolkit", "technical expertise",
        # Deliberately NOT "technologies" alone: a bare "Technologies:"
        # label inside a project's tech-stack line (handled by
        # extractors/projects.py's own _TECH_LABEL_RE) would exact-match
        # this alias table at the segmentation level too and get wrongly
        # promoted to a top-level Skills section header.
    ],
    "experience": [
        "professional experience", "work experience", "experience",
        "employment history", "career history", "work history",
        "relevant experience", "industry experience", "internship experience",
        "internships", "employment", "career", "professional history",
        "appointments",
    ],
    "education": [
        "education", "academic background", "educational qualification",
        "educational qualifications", "academic qualifications",
        "academic history", "qualifications", "education & training",
        "educational background",
    ],
    "certifications": [
        "certifications", "certification", "certificates",
        "licenses & certifications", "licenses and certifications",
        "courses & certifications", "professional certifications",
        "credentials", "professional credentials", "badges",
    ],
    "projects": [
        "projects", "personal projects", "key projects", "academic projects",
        "notable projects", "project experience", "selected projects",
        "selected work", "selected builds", "portfolio", "case studies",
        "featured projects",
    ],
    "awards": [
        "awards", "honors", "honors & awards", "awards & achievements",
        "achievements", "accomplishments",
    ],
    "languages": ["languages", "language proficiency"],
    "interests": ["interests", "hobbies", "hobbies & interests"],
    "volunteer": [
        "volunteer experience", "volunteering", "community involvement",
        "volunteer work",
    ],
    "publications": ["publications", "research", "research & publications"],
    "references": ["references", "referees"],
    "strengths": ["strengths", "professional strengths", "key strengths"],
    "personal_details": [
        "personal details", "personal information", "personal data",
        "additional information", "additional details",
    ],
    "declaration": ["declaration", "signature"],
}

# Sections without a dedicated extractor — recognized (and thus excluded
# from whatever real section precedes them) but not returned as structured
# data. Adding a new one here is a one-line change once an extractor exists.
_UNEXTRACTED_SECTIONS = {
    "awards", "languages", "interests", "volunteer", "publications",
    "references", "strengths", "personal_details",
}

_ALL_HEADER_PHRASES: List[Tuple[str, str]] = [
    (phrase, canonical) for canonical, phrases in _HEADER_ALIASES.items() for phrase in phrases
]
# Longest phrases first so "work experience" wins over a looser partial match.
_ALL_HEADER_PHRASES.sort(key=lambda p: -len(p[0]))


def _fuzzy_header_match(text: str, min_ratio: float = 0.88) -> Optional[str]:
    normalized = re.sub(r"[^a-z&/ ]", "", text.lower()).strip()
    if not normalized or len(normalized) > 40:
        return None

    # Exact match always wins outright, regardless of phrase length ordering.
    for phrase, canonical in _ALL_HEADER_PHRASES:
        if normalized == phrase:
            return canonical

    # A compound header combining two real sections into one line (e.g.
    # "EDUCATION & PERSONAL", "Skills & Certifications", "Research
    # Interests / Summary", "Tech / Tools") is a real convention this list
    # can't enumerate every combination of — if either side exactly
    # matches a known alias on its own, use that side's section rather
    # than falling through to a weak/no fuzzy match against the whole
    # compound phrase. The *first* segment wins when both sides happen to
    # match (mirrors how these headers usually name the primary section
    # first).
    if " & " in normalized or " and " in normalized or "/" in normalized:
        segments = re.split(r"\s*/\s*|\s+(?:&|and)\s+", normalized)
        for segment in segments:
            segment = segment.strip()
            for phrase, canonical in _ALL_HEADER_PHRASES:
                if segment == phrase:
                    return canonical

    # Otherwise pick the *best* fuzzy match across every phrase (not the
    # first one that happens to clear the threshold) — with phrases sorted
    # longest-first, a loose threshold could otherwise match a longer,
    # weakly-similar phrase before ever considering a short, near-exact one
    # (e.g. "Education" vs "certifications"/"certification" ratio ~0.6-0.64,
    # both encountered before the exact-length "education" phrase).
    best_canonical: Optional[str] = None
    best_ratio = 0.0
    for phrase, canonical in _ALL_HEADER_PHRASES:
        ratio = SequenceMatcher(None, normalized, phrase).ratio()
        if ratio >= min_ratio and ratio > best_ratio:
            best_ratio = ratio
            best_canonical = canonical
    return best_canonical


def _strip_branding_lines(lines: List[Line]) -> List[Line]:
    """Drop lines that are template banners/footers repeating on most/all
    pages (e.g. a recurring "Lumos logic" bar or a page header/footer),
    not resume content. Two independent signals, either is enough:
      (a) the *text* repeats verbatim on a large majority of pages, or
      (b) the *position* (x0, y0) repeats on a large majority of pages —
          catches a banner rendered as a positioned image with no
          alt-text/OCR text, or where per-page text differs slightly
          (e.g. a running page title) but the slot it occupies doesn't.
    Both deliberately require a *high* fraction of pages (not just "any 2")
    so a candidate's own name, which legitimately tends to appear twice
    (once as the page-1 heading, once again in a Declaration/signature
    block), is never mistaken for a repeating banner.
    """
    if not lines:
        return lines

    total_pages = max(l.page for l in lines)
    counts = Counter(l.normalized for l in lines)
    pages_seen_text: Dict[str, set] = {}
    for l in lines:
        pages_seen_text.setdefault(l.normalized, set()).add(l.page)

    # A genuine repeating banner/logo always lives in the header zone at the
    # top of the page — restricting the position signal to that zone is
    # essential, not just an optimization: on a long multi-page resume with
    # many pages of similarly-indented bullets, coincidental (x, y) overlap
    # between *unrelated* bullets on different pages becomes likely purely
    # by chance (consistent line-height spacing means bullets land on
    # near-identical y positions page to page) — this genuinely stripped
    # half of a real 6-page resume before this restriction existed.
    _POSITION_ZONE_MAX_Y = 100.0

    def position_key(l: Line) -> Optional[Tuple[float, float]]:
        # (0, 0) is the Line model's "position unknown" default (always true
        # for DOCX) — never a meaningful repeat signal.
        if l.x0 == 0.0 and l.y0 == 0.0:
            return None
        if l.y0 > _POSITION_ZONE_MAX_Y:
            return None
        return (round(l.x0), round(l.y0))

    pages_seen_pos: Dict[Tuple[float, float], set] = {}
    texts_seen_pos: Dict[Tuple[float, float], set] = {}
    for l in lines:
        key = position_key(l)
        if key is not None:
            pages_seen_pos.setdefault(key, set()).add(l.page)
            texts_seen_pos.setdefault(key, set()).add(l.normalized)

    def is_branding(l: Line) -> bool:
        norm = l.normalized
        if not norm or len(norm) > 60:
            return False
        if not any(ch.isalnum() for ch in norm):
            # A lone bullet/decoration glyph (PyMuPDF sometimes extracts a
            # bullet character as its own separate Line, distinct from the
            # text beside it) is not "branding text" just because the same
            # glyph naturally repeats throughout a long bulleted document —
            # it's ordinary punctuation, not a template banner.
            return False
        if total_pages > 1:
            # Repeats on a large majority of pages -> near-certainly a
            # banner/footer rather than coincidental content repetition.
            text_fraction = len(pages_seen_text[norm]) / total_pages
            if len(pages_seen_text[norm]) >= 2 and text_fraction >= 0.75:
                return True
            key = position_key(l)
            if key is not None:
                pos_fraction = len(pages_seen_pos[key]) / total_pages
                # A genuine banner/logo shows (near-)identical text every
                # time it repeats; a real content line that just happens to
                # land in the same page-margin slot on other pages (common
                # with consistent line-height spacing after a page break)
                # has *different* text each time — position alone, without
                # this, mistook several different bullet items for a banner
                # purely because they shared one pixel-identical slot.
                if len(pages_seen_pos[key]) >= 2 and pos_fraction >= 0.75 and len(texts_seen_pos[key]) <= 2:
                    return True
        else:
            # Single-page doc: only flag near-exact repeats within the page
            # (e.g. the same footer line printed 3+ times).
            if counts[norm] >= 3:
                return True
        return False

    return [l for l in lines if not is_branding(l)]


def _body_font_baseline(lines: List[Line]) -> float:
    sizes = [l.font_size for l in lines if l.font_size > 0]
    if not sizes:
        return 0.0
    return Counter(round(s, 1) for s in sizes).most_common(1)[0][0]


@dataclass
class Segmented:
    contact_lines: List[Line]
    sections: "list[tuple[str, list[Line]]]"  # ordered, canonical name -> lines


def _looks_like_header_format(line: Line, baseline: float) -> bool:
    # A short line rendered materially larger/bolder than body text is very
    # likely a section header even if its wording is a slight variant of
    # our keyword list.
    return bool(
        baseline and len(line.text) <= 40 and line.font_size >= baseline * 1.15 and line.bold
        and not re.search(r"\d{4}|@|http", line.text)
    )


def _is_header_line(line: Line, baseline: float) -> Optional[str]:
    """Returns the canonical section name if `line` reads as a section
    header, else None. Shared by the main header scan and by
    `_reorder_multi_column`, which needs the same signal to find where a
    page's shared "header zone" (name/contact/title, common to every
    column) ends and its per-column body content begins.
    """
    # 0.6 here was previously too loose: a bold, larger-than-body skills
    # *category* label like "Programming Languages" fuzzy-matches the
    # short alias "languages" at ratio 0.6, wrongly splitting the section
    # it lives in. 0.75 still catches real near-miss header wording ("Work
    # Experiences" -> 0.97, "Technical Skill" -> 0.97, "My Skills" -> 0.80)
    # without that false positive. A plain keyword match (no formatting
    # signal) still needs a tight ratio to avoid catching body text that
    # happens to mention e.g. "skills" in a sentence.
    min_ratio = 0.75 if _looks_like_header_format(line, baseline) else 0.88
    return _fuzzy_header_match(line.text, min_ratio=min_ratio)


def _resolve_headers(
    lines: List[Line], baseline: float, skill_matcher: Optional[SkillMatcher]
) -> List[Tuple[int, str]]:
    """Finds every header line and its canonical section, in two passes.

    Pass 1: every line that matches a known alias (`_is_header_line`,
    unchanged — this is the exact same signal `_reorder_multi_column`'s
    replacement, `resolve_reading_order`, already used to lay the page
    out) is a confirmed header immediately, with zero change in behavior
    from before this function existed. Any OTHER line that merely *looks*
    header-shaped (`score_heading_candidate`) becomes a "pending"
    candidate instead of being silently invisible.

    Pass 2: each pending candidate is classified by the actual *content*
    between it and the next candidate (confirmed or pending) —
    `classify_by_content` — since no fixed phrase list can enumerate every
    real resume's header wording. A pending candidate that doesn't
    classify confidently is dropped entirely, exactly like an
    unrecognized header always fell back to ordinary body text before.

    Because pass 1 is untouched and pass 2 only ever *adds* headers that
    were previously invisible, this can only add or improve section
    boundaries — it cannot change the outcome for any line that already
    matched an alias.
    """
    # The candidate's own name is reliably the single largest-font text
    # anywhere on the page (the same signal contact.py's own name
    # detection is built on) — which also means it reliably maxes out
    # every size-based heading signal, regardless of how those signals are
    # weighted. A real fixture's name got wrongly promoted to a pending
    # heading candidate this way, emptied its own contact block, and lost
    # the candidate's name/email/phone/location entirely. Excluding
    # whatever sits at (or within a hair of) the document's largest font
    # size mirrors contact.py's own tolerance and closes this off
    # structurally rather than by ever-finer visual-weight tuning.
    max_font_size = max((l.font_size for l in lines if l.text.strip()), default=0.0)

    provisional: List[Tuple[int, Optional[str]]] = []
    for i, line in enumerate(lines):
        canonical = _is_header_line(line, baseline)
        if canonical:
            provisional.append((i, canonical))
            continue
        if line.font_size >= max_font_size - 0.5:
            continue
        candidate = score_heading_candidate(line, baseline)
        if candidate.visual_score >= _MIN_VISUAL_SCORE:
            provisional.append((i, None))

    resolved: List[Tuple[int, str]] = []
    last_canonical: Optional[str] = None
    for idx, (i, canonical) in enumerate(provisional):
        if canonical is not None:
            resolved.append((i, canonical))
            last_canonical = canonical
            continue
        content_start = i + 1
        content_end = provisional[idx + 1][0] if idx + 1 < len(provisional) else len(lines)
        classified = classify_by_content(lines[content_start:content_end], skill_matcher)
        # A pending candidate that classifies to the *same* section as
        # whatever is already open is never a real second header — it can
        # only be an entry-label line inside the current section (a
        # company/institution name, say) that happened to clear the visual
        # bar too. Promoting it to a header would strip that label line
        # out of the section body entirely (headers are excluded from
        # body content), deleting real data the extractor needed — worse
        # than just leaving it as an unrecognized line the section already
        # absorbs correctly.
        if classified and classified != last_canonical:
            resolved.append((i, classified))
            last_canonical = classified
    return resolved


def segment(
    lines: List[Line],
    page_sizes: Optional[Dict[int, Tuple[float, float]]] = None,
    skill_matcher: Optional[SkillMatcher] = None,
) -> Segmented:
    lines = _strip_branding_lines(lines)
    if not lines:
        return Segmented(contact_lines=[], sections=[])

    baseline = _body_font_baseline(lines)
    # Real reading order — a page is modeled as vertical bands of 1..N
    # side-by-side regions (a full-width header, a sidebar+main split, a
    # later full-width section, all on the same page) rather than one
    # whole-page "two columns or not" verdict. See app/layout/regions.py.
    lines = resolve_reading_order(lines, page_sizes or {}, baseline, _is_header_line)

    headers = _resolve_headers(lines, baseline, skill_matcher)

    if not headers:
        return Segmented(contact_lines=lines, sections=[])

    contact_lines = lines[: headers[0][0]]
    # Contact block should only ever be page-1, pre-header content.
    contact_lines = [l for l in contact_lines if l.page == 1]

    # Group consecutive headers that share the same y0: a small side-by-side
    # sub-header row confined to one part of the page (e.g. "Education" |
    # "Personal Details" cards sitting next to each other) rather than a
    # sequence of genuine top-level headers. This is a *different* signal
    # from the page-level column detection in `_reorder_multi_column`: a
    # card like this is often too small a fraction of the page's content to
    # register as a real 2-column layout there, yet its two sub-headers
    # still land on the same row. A true 2-column *page* never produces
    # this: `_reorder_multi_column` already serializes the whole left
    # column before the whole right column, so a left-column and a
    # right-column header sharing a y0 are never adjacent in `headers`
    # here — only a genuine same-row pair is.
    def _has_position(l: Line) -> bool:
        # (0, 0) is the Line model's "position unknown" default (always true
        # for DOCX) — grouping-by-y0 would otherwise treat *every* header as
        # sharing one giant "row" (they all sit at y0=0) and collapse their
        # content into a single bucket.
        return l.x0 != 0.0 or l.y0 != 0.0

    groups: List[List[Tuple[int, str]]] = []
    gi = 0
    while gi < len(headers):
        group = [headers[gi]]
        gj = gi + 1
        if _has_position(lines[headers[gi][0]]):
            while gj < len(headers) and round(lines[headers[gj][0]].y0) == round(lines[headers[gi][0]].y0):
                group.append(headers[gj])
                gj += 1
        groups.append(group)
        gi = gj

    sections: List[Tuple[str, List[Line]]] = []
    for gidx, group in enumerate(groups):
        if any(canonical == "declaration" for _, canonical in group):
            break
        content_start = group[-1][0] + 1
        content_end = groups[gidx + 1][0][0] if gidx + 1 < len(groups) else len(lines)
        body_lines = lines[content_start:content_end]

        if len(group) == 1:
            sections.append((group[0][1], body_lines))
            continue

        # Side-by-side sub-header row: assign each body line to whichever
        # header's x0 it's nearest to, rather than bulk-slicing everything
        # onto whichever header happens to be last in reading order — that
        # would merge two unrelated cards' content (interleaved by y0, since
        # they're laid out in parallel columns) into one section.
        group_sorted = sorted(group, key=lambda h: lines[h[0]].x0)
        header_xs = [lines[idx].x0 for idx, _ in group_sorted]
        buckets: List[List[Line]] = [[] for _ in group_sorted]
        for l in body_lines:
            nearest = min(range(len(header_xs)), key=lambda k: abs(l.x0 - header_xs[k]))
            buckets[nearest].append(l)
        for (_, canonical), bucket in zip(group_sorted, buckets):
            sections.append((canonical, bucket))

    return Segmented(contact_lines=contact_lines, sections=sections)
