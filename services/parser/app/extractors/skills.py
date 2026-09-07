"""Skill extraction.

Three complementary techniques, in priority order:

0. **Real table extraction.** If the source document actually drew a
   genuine table for the Skills section (a PDF with ruling lines, or any
   DOCX table — see `extraction/pdf_extractor.extract_tables` and
   `extraction/docx_extractor.extract_tables`), its row/column structure is
   unambiguous: no guessing which line is a bold category label required.
   Preferred whenever a plausible 2-column table is found on a page the
   Skills section spans.
1. **Verbatim list extraction.** A resume's Skills section is, in the
   overwhelming majority of real cases, an explicit list: either "Category:
   item, item, item" on one line, or a bold category label line followed by
   a plain comma-separated detail line/table cell. Either way, the resume
   is *telling us directly* what its skills are — so once a (category,
   detail-text) segment is identified, every comma-separated item in it is
   trusted verbatim as a skill, preserving the source's own spelling and
   category label. This is what actually gets 1:1 recall against the
   source document, since no fixed taxonomy can ever keep up with a
   fast-moving space like AI tooling (e.g. "Langraph", "Qdrant Vector DB",
   "OpenAI Agent SDK" are all real skills a resume can list that no static
   list would contain).
2. **Taxonomy phrase-matching**, via spaCy `PhraseMatcher` over a curated
   skills taxonomy — architecturally the same technique the third-party
   `skillNer` package uses internally, reimplemented against our own
   taxonomy so we're not pinned to `skillNer`'s old spaCy version. This is
   the fallback for text that *isn't* a clean list — prose mentions of
   tools in the summary/experience/projects sections, or a Skills section
   with no explicit Skills section detected at all (full-document scan).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from spacy.language import Language
from spacy.matcher import PhraseMatcher

from ..extraction.models import ExtractedTable, Line
from .common import clean_text, is_bullet_line, strip_bullet

_TAXONOMY_PATH = Path(__file__).resolve().parent.parent / "data" / "skills_taxonomy.json"

_SKIP_LINE_TEXTS = {"category", "details"}
_CATEGORY_INLINE_RE = re.compile(r"^(?P<category>[^:]{2,40}):\s*(?P<rest>.+)$")


def _load_taxonomy() -> Dict[str, str]:
    """Return {skill_name: category} for every skill in the taxonomy file."""
    with open(_TAXONOMY_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    mapping: Dict[str, str] = {}
    for category, skills in raw.items():
        for skill in skills:
            mapping[skill] = category
    return mapping


_SKILL_CATEGORY = _load_taxonomy()


def _variants(skill: str) -> List[str]:
    """A couple of cheap surface variants (plural forms) so e.g. "Code
    Review" in the taxonomy still matches "Code Reviews" in a resume."""
    variants = {skill}
    if skill.endswith("s") and len(skill) > 3:
        variants.add(skill[:-1])
    else:
        variants.add(skill + "s")
    variants.add(skill.replace("-", " "))
    variants.add(skill.replace(" ", "-"))
    return list(variants)


class SkillMatcher:
    """Wraps a spaCy `PhraseMatcher` built once from the taxonomy."""

    def __init__(self, nlp: Language):
        self._nlp = nlp
        self._matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
        self._match_id_to_skill: Dict[str, str] = {}
        for skill in _SKILL_CATEGORY:
            match_id = f"SKILL::{skill}"
            patterns = [nlp.make_doc(v) for v in _variants(skill)]
            self._matcher.add(match_id, patterns)
            self._match_id_to_skill[match_id] = skill

    def match(self, text: str) -> List[str]:
        """Return canonical taxonomy skill names found in `text`, longest
        match preferred when patterns overlap."""
        if not text.strip():
            return []
        doc = self._nlp.make_doc(text)
        matches = self._matcher(doc)
        # Keep longest non-overlapping spans first (e.g. "Core Data" over a
        # spurious partial hit), then dedupe by canonical skill name.
        matches.sort(key=lambda m: -(m[2] - m[1]))
        used_tokens: set = set()
        found: List[str] = []
        seen: set = set()
        for match_id, start, end in matches:
            span_tokens = set(range(start, end))
            if span_tokens & used_tokens:
                continue
            skill = self._match_id_to_skill[self._nlp.vocab.strings[match_id]]
            if skill.lower() not in seen:
                seen.add(skill.lower())
                found.append(skill)
            used_tokens |= span_tokens
        return found


def _segment_by_category(lines: List[Line]) -> List[Tuple[Optional[str], List[str], bool]]:
    """Best-effort grouping of a Skills section into (category, detail_lines,
    all_bulleted) chunks — detail lines kept separate (not pre-joined) so
    the caller can tell a comma-separated list that merely wraps across
    lines apart from a "one skill per line" badge/pill layout (see
    `_split_segment_items`). `all_bulleted` (every detail line in the
    segment was itself bullet-prefixed in the source) is a strong,
    unambiguous per-item signal in its own right, tracked separately from
    that comma-based heuristic. Conventions handled:
      (a) a bold short category label line, followed by plain detail
          line(s)/a table cell (e.g. "Languages & Frameworks" / "Swift,
          SwiftUI, Combine"), or
      (b) "Category: item, item, item" inline on one line, category and
          detail together — occasionally wrapping onto a following plain
          line with no colon of its own, or
      (c) a bold category label followed by one bulleted skill per line
          (e.g. "Key Skills" / "• Tally ERP 9 / Prime (Accounting, ...)").
    """
    segments: List[Tuple[Optional[str], List[str], bool]] = []
    pending_category_parts: List[str] = []
    current_category: Optional[str] = None
    current_detail_parts: List[str] = []
    current_all_bulleted = True

    def flush_detail():
        nonlocal current_detail_parts, current_all_bulleted
        if current_detail_parts:
            segments.append((current_category, current_detail_parts, current_all_bulleted))
            current_detail_parts = []
        current_all_bulleted = True

    for line in lines:
        norm = line.normalized
        if not norm or norm in _SKIP_LINE_TEXTS:
            continue
        text = clean_text(line.text)
        inline = _CATEGORY_INLINE_RE.match(text)
        looks_like_category_label = line.bold and "," not in text and len(text) <= 40 and not is_bullet_line(text)
        if inline:
            flush_detail()
            current_category = clean_text(inline.group("category"))
            current_detail_parts = [inline.group("rest")]
            current_all_bulleted = False
        elif looks_like_category_label:
            flush_detail()
            pending_category_parts.append(text)
        else:
            if pending_category_parts:
                current_category = " ".join(pending_category_parts).strip(" &:")
                pending_category_parts = []
            bulleted = is_bullet_line(text)
            current_detail_parts.append(strip_bullet(text) if bulleted else text)
            current_all_bulleted = current_all_bulleted and bulleted

    flush_detail()
    return segments


def _split_verbatim_list(text: str) -> Optional[List[str]]:
    """If `text` looks like a plain comma-separated list of items (the
    overwhelming convention for a resume's skills detail text/cell),
    split and return each item verbatim — preserving the source's own
    spelling instead of forcing it through the taxonomy. Parenthesized
    sub-items (e.g. "AWS (Lambda, S3, EventBridge Scheduler)") are treated
    as additional comma-separated items rather than kept as one blob.
    Returns None if the text doesn't look like a clean list (e.g. a prose
    sentence), so the caller can fall back to taxonomy matching instead.
    """
    normalized = text.replace("(", ", ").replace(")", "")
    parts = [clean_text(p) for p in normalized.split(",")]
    parts = [p for p in parts if p]
    if not parts or len(parts) > 30 or any(len(p) > 60 for p in parts):
        return None
    return parts


def _split_segment_items(detail_lines: List[str], all_bulleted: bool = False) -> Optional[List[str]]:
    """Turn a segment's raw detail line(s) into individual verbatim skill
    items. Three conventions, tried in order:
      0. every detail line was itself bullet-prefixed in the source (e.g.
         "• Tally ERP 9 / Prime (Accounting, Billing & GST Entries)") — an
         explicit, unambiguous per-item signal from the document's own
         formatting, stronger than guessing from punctuation. One skill
         per line unconditionally, *even if* an individual item happens to
         contain a comma or parenthetical of its own (e.g. one bullet
         reading "Tool (A, B, C)") — that comma is part of *that* item, not
         a separator between items, so it must not be forced through the
         comma-list path below;
      1. a comma-separated list, possibly wrapped across lines (e.g. a
         table cell's text wrapping mid-phrase, "Core" / "Animation") —
         the lines are joined with a space *first* so the wrapped phrase
         reads as one continuous string before splitting on commas;
      2. no comma anywhere in the whole segment, but more than one detail
         line, each already short — a "pill"/badge-style skills section
         (one visually distinct tag per line, common in modern templates),
         where joining them would just produce one long unsplittable
         sentence-shaped blob. Each line is its own item here instead.
    Returns None (falls back to taxonomy matching) if none of these fit,
    e.g. genuine prose.
    """
    if all_bulleted and len(detail_lines) > 0:
        items = [clean_text(l) for l in detail_lines]
        items = [i for i in items if i]
        if items:
            return items

    joined = " ".join(detail_lines)
    if "," in joined or "(" in joined:
        return _split_verbatim_list(joined)
    if len(detail_lines) > 1:
        items = [clean_text(l) for l in detail_lines]
        items = [i for i in items if i]
        if items and all(len(i) <= 50 for i in items):
            return items
    return _split_verbatim_list(joined)


def _cluster_by_column(lines: List[Line], tolerance: float = 15.0) -> List[List[Line]]:
    """Group lines into left-to-right x0 clusters ("columns"), each
    internally sorted top-to-bottom. Used to reconstruct a skills section
    laid out as several parallel wrapped-text lists (a "pill"/badge grid:
    2-3 side-by-side columns of short phrases, each phrase itself wrapping
    across multiple short lines) — read top-to-bottom-then-Y-sorted, those
    columns interleave row by row into nonsense; grouped by column first,
    each column reads correctly.
    """
    if not lines:
        return []
    xs = sorted({l.x0 for l in lines})
    groups: List[List[float]] = [[xs[0]]]
    for x in xs[1:]:
        if x - groups[-1][-1] > tolerance:
            groups.append([x])
        else:
            groups[-1].append(x)
    boundaries = [(groups[i][-1] + groups[i + 1][0]) / 2 for i in range(len(groups) - 1)]

    def col_index(x0: float) -> int:
        for i, b in enumerate(boundaries):
            if x0 < b:
                return i
        return len(boundaries)

    columns: List[List[Line]] = [[] for _ in groups]
    for l in lines:
        columns[col_index(l.x0)].append(l)
    for col in columns:
        col.sort(key=lambda l: l.y0)
    return columns


def _join_wrapped_column_items(lines: List[Line]) -> List[str]:
    """Reconstruct discrete skill-phrase items from one column's raw text
    lines, where a single item is sometimes wrapped across 2+ lines with no
    per-item delimiter of its own. Only two signals mean "the next line
    continues this same item": a trailing "&"/"and" (a compound phrase
    still being written, e.g. "Business Research &" / "Competitive
    Intelligence") or an unclosed "(" (a parenthetical qualifier still
    open, e.g. "Proposal Writing (RFI, RFP," / "Case Studies, Capability
    Decks)"). Anything else starts a new item.
    """
    items: List[str] = []
    current = ""
    open_parens = 0
    for line in lines:
        text = clean_text(line.text)
        if not text:
            continue
        if current and open_parens == 0 and not current.rstrip().endswith(("&", "and")):
            items.append(current)
            current = ""
        current = f"{current} {text}".strip() if current else text
        open_parens = max(0, open_parens + text.count("(") - text.count(")"))
    if current:
        items.append(current)
    return items


def _extract_from_column_grid(skills_lines: List[Line]) -> Optional[List[Tuple[str, Optional[str]]]]:
    """Detects and parses a multi-column "pill" skills grid — see
    `_cluster_by_column`/`_join_wrapped_column_items`. Only fires when
    there's no bold category-label line anywhere in the section (the
    signal the row-based `_segment_by_category` convention relies on) and
    the lines genuinely cluster into 3+ side-by-side columns with several
    lines each; otherwise returns None so the caller falls through to the
    normal row-based segmentation, which handles every other convention
    (including an ordinary 2-column "label | detail" row layout — a real
    grid needs a *third* column to be unambiguous, since 2 columns is also
    exactly what that convention produces per row).
    """
    real_lines = [l for l in skills_lines if clean_text(l.text)]
    if not real_lines or any(l.bold for l in real_lines):
        return None
    columns = _cluster_by_column(real_lines)
    if len(columns) < 3 or any(len(col) < 2 for col in columns):
        return None

    results: List[Tuple[str, Optional[str]]] = []
    for col in columns:
        for item in _join_wrapped_column_items(col):
            for skill in _split_verbatim_list(item) or [item]:
                if skill:
                    results.append((skill, None))
    return results or None


_HEADER_CELL_TEXTS = {"category", "details", "skill", "skills", "type", "area"}


def _extract_from_tables(
    tables: List[ExtractedTable], relevant_pages: set
) -> List[Tuple[str, Optional[str]]]:
    """Pull (skill, category) pairs from a genuine 2-column table found on
    one of the pages the Skills section spans. `[]` if none qualifies —
    the caller then falls through to the line-heuristic approach, which is
    exactly what's needed for a table-*look* achieved via plain whitespace
    alignment rather than an actual drawn table.
    """
    results: List[Tuple[str, Optional[str]]] = []
    for table in tables:
        if relevant_pages and table.page not in relevant_pages:
            continue
        col_counts = [len(r) for r in table.rows]
        if not col_counts or max(col_counts) != 2:
            continue
        for row in table.rows:
            if len(row) < 2:
                continue
            category_cell, detail_cell = clean_text(row[0]), clean_text(row[1])
            if not category_cell or not detail_cell:
                continue
            if category_cell.lower() in _HEADER_CELL_TEXTS:
                continue
            items = _split_verbatim_list(detail_cell) or ([detail_cell] if len(detail_cell) <= 60 else None)
            if items:
                for item in items:
                    results.append((item, category_cell))
    return results


def extract_skills(
    matcher: SkillMatcher,
    skills_lines: List[Line],
    all_lines: List[Line],
    tables: Optional[List[ExtractedTable]] = None,
) -> List[Tuple[str, Optional[str]]]:
    """Returns an ordered, deduped list of (skill, category) tuples.

    Prefers a genuine table (see `_extract_from_tables`) if one is found on
    a page the Skills section spans. Otherwise, for each (category,
    detail-text) segment of the Skills section inferred from line
    formatting: if the detail text is a clean comma-separated list, every
    item is trusted verbatim (see `_split_verbatim_list`) so real-world
    skills outside the curated taxonomy are never silently dropped;
    otherwise it's mined via taxonomy phrase-matching instead (prose-style
    mentions). Falls back to scanning the full document via taxonomy
    matching only if no explicit Skills section was detected at all.
    """
    if tables and skills_lines:
        relevant_pages = {l.page for l in skills_lines}
        table_results = _extract_from_tables(tables, relevant_pages)
        if table_results:
            deduped: Dict[str, Tuple[str, Optional[str]]] = {}
            for skill, category in table_results:
                deduped.setdefault(skill.lower(), (skill, category))
            return list(deduped.values())
    found: Dict[str, Tuple[str, Optional[str]]] = {}  # lower(skill) -> (display skill, category)

    def add(skill: str, category: Optional[str]) -> None:
        key = skill.lower()
        if key not in found:
            found[key] = (skill, category)

    if skills_lines:
        grid_results = _extract_from_column_grid(skills_lines)
        if grid_results:
            for skill, category in grid_results:
                add(skill, category)
            return list(found.values())

        for category, detail_lines, all_bulleted in _segment_by_category(skills_lines):
            items = _split_segment_items(detail_lines, all_bulleted)
            if items:
                for item in items:
                    add(item, category)
            else:
                for skill in matcher.match(" ".join(detail_lines)):
                    add(skill, category or _SKILL_CATEGORY.get(skill))

    if not found:
        full_text = " ".join(clean_text(l.text) for l in all_lines)
        for skill in matcher.match(full_text):
            add(skill, _SKILL_CATEGORY.get(skill))

    return list(found.values())
