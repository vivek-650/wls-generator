"""Projects section extraction.

Real resumes use several conventions for a project entry's title line, all
handled here:
  - a short bold title on its own (optionally a size-jump above body text,
    optionally a top-level bullet), with tech stack given by a separate
    bullet line below containing "|" (e.g. "iOS | Swift, MVVM, BLE");
  - name, "- Link", and the tech stack all packed onto one bold line (e.g.
    "Samvad AI - Link  Next.js, Prisma, AWS (Lambda + S3), OpenAI API") —
    the tech stack here is comma-separated text following a "- Link"
    marker or a lone separator glyph, not a "|".
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

from ..extraction.models import Line
from .common import body_baseline, clean_text, is_bullet_line, is_entry_title_line, strip_bullet

_LINK_MARKER_RE = re.compile(r"\s*[-–—]\s*Link\b", re.IGNORECASE)
_LEADING_GLYPHS_RE = re.compile(r"^[^A-Za-z0-9(]+")

# Fallback for a third convention: no bold, no size jump, no bullet at
# all — a project's name is just inline plain prose, immediately followed
# by a parenthetical tag and a colon (e.g. "Flinkit (On-Page SEO):
# Developed and implemented..."), reading as one continuously-wrapping
# paragraph with zero visual distinction between "title" and "description".
# The required parenthetical keeps this specific (won't fire on an
# ordinary "Note: ..." aside) — the whole section's lines are joined into
# one string first so a title that itself wraps mid-phrase across two PDF
# lines (a real case: "Dame Essentials (Performance" / "Marketing):
# Created...") is still matched as one continuous phrase.
_INLINE_TITLE_RE = re.compile(r"(?P<name>[A-Z][\w&,'.\- ]{0,50}?\([^()]{1,60}\))\s*:\s*")


# A "Technologies / Tools Used: X, Y" line is sometimes styled exactly like
# a title line (bold, size-jumped) — without this, it gets mistaken for the
# start of a brand-new, name-less project rather than a tech-stack
# declaration belonging to the *preceding* one.
_TECH_LABEL_RE = re.compile(
    r"^(?:technologies|technology|tools?|tech\s*stack)"
    r"(?:\s*/\s*(?:technologies|technology|tools?|tech\s*stack))?"
    r"\s*(?:used)?\s*:\s*(?P<items>.*)$",
    re.IGNORECASE,
)


def _is_tech_stack_label_line(text: str) -> bool:
    return bool(_TECH_LABEL_RE.match(text))


def _parse_tech_stack_label(text: str) -> List[str]:
    m = _TECH_LABEL_RE.match(text)
    if not m:
        return []
    items = [clean_text(t) for t in m.group("items").split(",")]
    return [t for t in items if t]


def _split_tech_stack(line_text: str) -> Optional[List[str]]:
    if "|" not in line_text:
        return None
    _, _, tail = line_text.rpartition("|")
    items = [clean_text(t) for t in tail.split(",")]
    items = [t for t in items if t]
    return items or None


def _split_title_line(text: str) -> Tuple[str, Optional[List[str]]]:
    """Split a single title line into (name, techStack).

    Tries, in order: a "- Link" marker (tech stack follows, after
    stripping a leading bullet/icon glyph); a "|" marker (matches the
    separate-bullet-line convention, occasionally used inline instead);
    otherwise the whole line is the name and there's no inline tech stack
    (it may still come from a separate "|" bullet line below, via
    `_split_tech_stack`).
    """
    m = _LINK_MARKER_RE.search(text)
    if m:
        name = clean_text(text[: m.start()])
        rest = _LEADING_GLYPHS_RE.sub("", text[m.end() :]).strip()
        tech_stack = [clean_text(t) for t in rest.split(",")] if rest else []
        tech_stack = [t for t in tech_stack if t]
        return name, (tech_stack or None)
    if "|" in text:
        name, _, tail = text.partition("|")
        tech_stack = [clean_text(t) for t in tail.split(",")]
        tech_stack = [t for t in tech_stack if t]
        return clean_text(name), (tech_stack or None)
    return clean_text(text), None


def _extract_inline_titled_projects(section_lines: List[Line]) -> List[dict]:
    text = clean_text(" ".join(clean_text(l.text) for l in section_lines if clean_text(l.text)))
    matches = list(_INLINE_TITLE_RE.finditer(text))
    if not matches:
        return []
    projects: List[dict] = []
    for idx, m in enumerate(matches):
        name = clean_text(m.group("name"))
        if not name:
            continue
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        desc_text = clean_text(text[start:end])
        projects.append({"name": name, "description": [desc_text] if desc_text else [], "techStack": []})
    return projects


def extract_projects(section_lines: List[Line]) -> List[dict]:
    if not section_lines:
        return []

    baseline = body_baseline(section_lines)
    title_indices = [
        i
        for i, l in enumerate(section_lines)
        if is_entry_title_line(l, baseline)
        and not _is_tech_stack_label_line(clean_text(strip_bullet(l.text)))
    ]
    if not title_indices:
        return _extract_inline_titled_projects(section_lines)

    projects: List[dict] = []
    for idx, title_i in enumerate(title_indices):
        title_text = clean_text(strip_bullet(section_lines[title_i].text))
        name, inline_tech_stack = _split_title_line(title_text)
        end = title_indices[idx + 1] if idx + 1 < len(title_indices) else len(section_lines)
        body_lines = section_lines[title_i + 1 : end]

        tech_stack: List[str] = inline_tech_stack or []
        description: List[str] = []
        tech_line_consumed = bool(inline_tech_stack)
        for line in body_lines:
            text = clean_text(line.text)
            if not text:
                continue
            if _is_tech_stack_label_line(text):
                maybe_tech = _parse_tech_stack_label(text)
                if maybe_tech:
                    tech_stack = maybe_tech
                    tech_line_consumed = True
                continue
            if is_bullet_line(text):
                stripped = strip_bullet(text)
                if not tech_line_consumed:
                    maybe_tech = _split_tech_stack(stripped)
                    if maybe_tech:
                        tech_stack = maybe_tech
                        tech_line_consumed = True
                        continue
                description.append(stripped)
            elif description:
                description[-1] = f"{description[-1]} {text}".strip()
            else:
                description.append(text)

        if not name:
            continue
        projects.append({"name": name, "description": description, "techStack": tech_stack})

    return projects
