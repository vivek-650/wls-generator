"""Region detection: split one page's lines into vertical bands, each band
holding 1..N side-by-side regions, instead of one whole-page "two columns or
not" verdict.

This directly generalizes the previous `_detect_column_boundary` /
`_reorder_multi_column` pair from `segmentation.py`: those found a single
candidate x-gap and either trusted it for the *entire* page or rejected it
entirely. Real sidebar templates aren't that uniform — a full-width header,
or a full-width section inserted partway down the sidebar/main-content
split, is common. This module still finds one candidate boundary per page
(one gutter position is the realistic case for a resume template; detecting
several independent boundaries at different y-ranges is deliberately out of
scope for this pass — see the architecture doc's Phase 2/3 roadmap) but
decides band-by-band whether the content sits on one side, the other, or
spans the whole page width, so a full-width interruption doesn't force
every subsequent line into a column it was never actually part of.

The full-width/left/right decision is made per *line*, not per native
PyMuPDF block, deliberately — see `_line_side`'s docstring for why trusting
PyMuPDF's own block grouping here produced wrong results on a genuine
2-column fixture during development.
"""
from __future__ import annotations

from typing import Callable, Dict, List, Optional, Tuple

from ..extraction.models import Line

# A real column gutter is a wide, unambiguous gap — 40pt comfortably exceeds
# normal word/indent spacing, which is what would otherwise produce false
# positives on an ordinary single-column resume. Matches the threshold
# proven necessary against real fixtures this session.
_MIN_GUTTER_PT = 40.0

# What actually distinguishes a real sidebar from a single-column resume
# that merely right-aligns a date next to each entry (producing the same
# kind of x0 gap without being a second column at all) is that *both* sides
# carry substantial, comparable prose — weighted by character count, not
# line count, so a scattering of short dates can't pass this.
_MIN_CHAR_SHARE = 0.2

# A block spanning at least this fraction of the page width is a full-width
# element (a section title, a paragraph, a table) regardless of exactly
# where its edges fall relative to the candidate column boundary.
_FULL_WIDTH_RATIO = 0.6


def _sort_key(l: Line) -> Tuple[float, float]:
    return (round(l.y0), l.x0)


def _find_candidate_boundary(lines: List[Line]) -> Optional[float]:
    """The widest x0 gap on the page, gated by the character-share guard —
    identical logic to the previous `_detect_column_boundary`, kept as a
    page-wide decision ("is this page a candidate sidebar template at all")
    rather than something recomputed per band.
    """
    xs = sorted({round(l.x0) for l in lines if l.x0 > 0})
    if len(xs) < 2:
        return None
    best_gap = 0.0
    best_boundary: Optional[float] = None
    for a, b in zip(xs, xs[1:]):
        gap = b - a
        if gap > best_gap:
            best_gap = gap
            best_boundary = (a + b) / 2
    if best_gap < _MIN_GUTTER_PT or best_boundary is None:
        return None

    left_chars = sum(len(l.text) for l in lines if l.x0 < best_boundary)
    right_chars = sum(len(l.text) for l in lines if l.x0 >= best_boundary)
    total_chars = left_chars + right_chars
    if total_chars == 0:
        return None
    min_share = _MIN_CHAR_SHARE * total_chars
    if left_chars < min_share or right_chars < min_share:
        return None
    return best_boundary


def _line_side(line: Line, boundary: float, page_width: float) -> str:
    """Classified per *line*, not per native PyMuPDF block — block
    grouping turns out not to reliably respect visual column structure:
    two lines from visually distinct left/right columns that happen to sit
    close together vertically can be merged into one native block by
    PyMuPDF's own layout algorithm, which would make a real 2-column
    section's block bbox span most of the page width and get misread as a
    full-width interruption. A single line's own bbox doesn't have that
    problem.

    Left/right is decided by `x0` alone, deliberately never by whether the
    line's `x1` also stays clear of `boundary`: a narrow column's own
    wrapped text routinely extends past the gutter position computed from
    *starting* x-positions (the boundary sits between where each column's
    lines *begin*, not past where a column's widest wrapped line happens
    to *end*) — requiring x1 to also respect the boundary misclassified
    ordinary wrapped left-column lines as full-width on a real 2-column
    fixture during development. Full-width is instead its own independent,
    width-ratio-only signal.
    """
    width = max(0.0, line.x1 - line.x0)
    if page_width > 0 and width >= _FULL_WIDTH_RATIO * page_width:
        return "full"
    return "left" if line.x0 < boundary else "right"


def detect_page_regions(
    page_lines: List[Line],
    baseline: float,
    is_header_line: Callable[[Line, float], Optional[str]],
    page_width: float = 0.0,
) -> List[List[List[Line]]]:
    """Returns an ordered list of bands; each band is an ordered list of
    regions; each region is a `List[Line]` already sorted into that
    region's own internal reading order. Concatenating every region of
    every band, in order, *is* this page's reading order.

    A single-column page (the overwhelming majority) — or any page where no
    trustworthy column boundary is found — returns exactly one band holding
    one region: every line, sorted by `(round(y0), x0)`. This is the same
    fallback the old `_reorder_multi_column` used, so pages that never had
    a column story to begin with are byte-for-byte unaffected.
    """
    if not page_lines:
        return []

    if not any(l.has_position for l in page_lines):
        # DOCX (or any source with no real geometry) — nothing spatial to
        # reason about; pass through in extraction order, exactly like the
        # previous zero-position special-case.
        return [[sorted(page_lines, key=lambda l: l.order)]]

    fallback: List[List[List[Line]]] = [[sorted(page_lines, key=_sort_key)]]

    boundary = _find_candidate_boundary(page_lines)
    if boundary is None:
        return fallback

    headers = [l for l in page_lines if is_header_line(l, baseline)]
    if not headers:
        return fallback

    # A genuine sidebar template runs *independent* sections in both
    # columns (a "Skills" header on one side, an "Experience" header on the
    # other) — a wide gap with header(s) on only one side is instead an
    # ordinary single-column resume with a date/location margin column (or
    # the mirror case, a right-aligned date): real, but not a second column
    # of *sections* to build bands around. This is deliberately a page-wide
    # decision, not a per-band one — once a page is confirmed to be a real
    # sidebar template, later full-width interruptions are handled by
    # banding below, not by re-litigating "is this a sidebar" per band.
    left_has_header = any(l.x0 < boundary for l in headers)
    right_has_header = any(l.x0 >= boundary for l in headers)
    if not (left_has_header and right_has_header):
        return fallback

    header_y = min(l.y0 for l in headers)
    header_zone = [l for l in page_lines if l.y0 < header_y]
    body_lines = [l for l in page_lines if l.y0 >= header_y]

    bands: List[List[List[Line]]] = []
    if header_zone:
        bands.append([sorted(header_zone, key=_sort_key)])

    body_sorted = sorted(body_lines, key=_sort_key)

    current_side_lines: Dict[str, List[Line]] = {"left": [], "right": []}
    current_full_lines: List[Line] = []

    def flush_split_band() -> None:
        if current_side_lines["left"] or current_side_lines["right"]:
            regions = [
                sorted(current_side_lines[side], key=_sort_key)
                for side in ("left", "right")
                if current_side_lines[side]
            ]
            bands.append(regions)
            current_side_lines["left"] = []
            current_side_lines["right"] = []

    def flush_full_band() -> None:
        if current_full_lines:
            bands.append([sorted(current_full_lines, key=_sort_key)])
            current_full_lines.clear()

    for line in body_sorted:
        side = _line_side(line, boundary, page_width)
        if side == "full":
            flush_split_band()
            current_full_lines.append(line)
        else:
            flush_full_band()
            current_side_lines[side].append(line)
    flush_split_band()
    flush_full_band()

    return bands
