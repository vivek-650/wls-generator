"""Unit tests for app/layout/ — geometry primitives, region detection, and
reading-order reconstruction. These are hand-built Line lists (no PDF
fixtures needed) specifically targeting cases the *old* single
global-boundary algorithm could not represent, plus every guard proven
necessary against real fixtures this session.
"""
from __future__ import annotations

from typing import Optional

import pytest

from app.extraction.models import Line
from app.layout import resolve_reading_order
from app.layout.geometry import BBox, contains, horizontal_gap, iou, vertical_overlap, x_alignment_score
from app.layout.regions import detect_page_regions


# ---------------------------------------------------------------------------
# geometry.py — pure, no Line/PDF concepts involved
# ---------------------------------------------------------------------------


def test_horizontal_gap_between_non_overlapping_boxes():
    a = BBox(0, 0, 10, 10)
    b = BBox(20, 0, 30, 10)
    assert horizontal_gap(a, b) == 10
    assert horizontal_gap(b, a) == 10  # symmetric


def test_horizontal_gap_zero_when_overlapping():
    a = BBox(0, 0, 10, 10)
    b = BBox(5, 0, 15, 10)
    assert horizontal_gap(a, b) == 0


def test_vertical_overlap():
    a = BBox(0, 0, 10, 10)
    b = BBox(0, 5, 10, 15)
    assert vertical_overlap(a, b) == 5
    c = BBox(0, 20, 10, 30)
    assert vertical_overlap(a, c) == 0


def test_iou_identical_boxes_is_one():
    a = BBox(0, 0, 10, 10)
    assert iou(a, a) == pytest.approx(1.0)


def test_iou_disjoint_boxes_is_zero():
    a = BBox(0, 0, 10, 10)
    b = BBox(100, 100, 110, 110)
    assert iou(a, b) == 0


def test_contains():
    outer = BBox(0, 0, 100, 100)
    inner = BBox(10, 10, 50, 50)
    assert contains(outer, inner)
    assert not contains(inner, outer)


def test_x_alignment_score_shared_left_edge():
    a = BBox(10, 0, 50, 10)
    b = BBox(10, 20, 60, 30)
    assert x_alignment_score(a, b) == pytest.approx(1.0)


def test_x_alignment_score_right_aligned_not_rewarded():
    # A right-aligned date column shares a *right* edge, not a left one —
    # x_alignment_score must not reward that, or it would reintroduce the
    # "right-aligned date looks like a column" false positive.
    a = BBox(10, 0, 100, 10)
    b = BBox(300, 20, 390, 30)
    assert x_alignment_score(a, b) < 0.3


# ---------------------------------------------------------------------------
# regions.py / reading_order.py — hand-built Line lists
# ---------------------------------------------------------------------------

_PAGE_WIDTH = 600.0


def _no_headers(_line: Line, _baseline: float) -> Optional[str]:
    return None


def _line(text: str, x0: float, y0: float, x1: Optional[float] = None, page: int = 1, order: int = 0) -> Line:
    return Line(
        text=text,
        page=page,
        order=order,
        font_size=10.0,
        bold=False,
        x0=x0,
        y0=y0,
        x1=x1 if x1 is not None else x0 + len(text) * 5.0,
        y1=y0 + 10.0,
    )


def _header(text: str, x0: float, y0: float, x1: Optional[float] = None, page: int = 1, order: int = 0) -> Line:
    l = _line(text, x0, y0, x1, page, order)
    l.bold = True
    l.font_size = 13.0
    return l


def _headers_named(*names: str):
    def is_header(line: Line, _baseline: float) -> Optional[str]:
        return line.text if line.text in names else None

    return is_header


def test_single_column_page_returns_one_band_one_region():
    lines = [_line(f"line {i}", 40, 20 + i * 12, x1=200) for i in range(5)]
    bands = detect_page_regions(lines, baseline=10.0, is_header_line=_no_headers, page_width=_PAGE_WIDTH)
    assert len(bands) == 1
    assert len(bands[0]) == 1
    assert len(bands[0][0]) == 5


def test_docx_lines_no_position_pass_through_in_extraction_order():
    # DOCX lines are always (0, 0) — the existing "position unknown"
    # sentinel — and must skip spatial region detection entirely, exactly
    # like the previous zero-position special-case in _reorder_multi_column.
    lines = [
        Line(text="third", page=1, order=2, font_size=10.0, bold=False),
        Line(text="first", page=1, order=0, font_size=10.0, bold=False),
        Line(text="second", page=1, order=1, font_size=10.0, bold=False),
    ]
    bands = detect_page_regions(lines, baseline=10.0, is_header_line=_no_headers, page_width=0.0)
    assert len(bands) == 1 and len(bands[0]) == 1
    assert [l.text for l in bands[0][0]] == ["first", "second", "third"]


def test_right_aligned_date_is_not_mistaken_for_a_second_column():
    # A single-column resume that right-aligns a date next to each entry
    # title produces exactly the same kind of x0 gap as a real sidebar —
    # the character-count-share guard must still reject it here.
    lines = [
        _header("EXPERIENCE", 40, 10),
        _line("Senior Engineer at Example Corp, a fairly long title line", 40, 30, x1=380),
        _line("2022 - 2024", 480, 30, x1=560),
        _line("Built and shipped several major product features over two years.", 40, 50, x1=420),
        _line("2020 - 2022", 480, 70, x1=560),
    ]
    bands = detect_page_regions(lines, baseline=10.0, is_header_line=_no_headers, page_width=_PAGE_WIDTH)
    assert len(bands) == 1 and len(bands[0]) == 1, "a right-aligned date must not create a second region"


def test_genuine_sidebar_with_headers_on_both_sides_splits_into_two_regions():
    is_header = _headers_named("SKILLS", "EXPERIENCE")
    lines = [
        _header("SKILLS", 40, 10, x1=100),
        _line("Python, TypeScript, SQL, a good amount of supporting detail text here", 40, 30, x1=190),
        _header("EXPERIENCE", 260, 10, x1=360),
        _line("Senior Engineer — built and shipped several product features over two years", 260, 30, x1=560),
    ]
    bands = detect_page_regions(lines, baseline=10.0, is_header_line=is_header, page_width=_PAGE_WIDTH)
    assert len(bands) == 1
    assert len(bands[0]) == 2, "a real sidebar (headers on both sides) must produce two regions"
    left_texts = {l.text for l in bands[0][0]}
    right_texts = {l.text for l in bands[0][1]}
    assert "SKILLS" in left_texts
    assert "EXPERIENCE" in right_texts


def test_margin_label_column_without_independent_header_collapses_to_one_region():
    # A date/location margin column next to flowing summary prose (a real
    # regression this session) has a header only on the main-content side —
    # must collapse to a single region, not force the margin into its own
    # column and scramble row-level pairing.
    is_header = _headers_named("PROFILE")
    lines = [
        _header("PROFILE", 260, 10, x1=340),
        _line("A seasoned professional with years of relevant hands-on experience.", 40, 30, x1=200),
        _line("More narrative summary text continues on this line as well.", 260, 30, x1=560),
    ]
    bands = detect_page_regions(lines, baseline=10.0, is_header_line=is_header, page_width=_PAGE_WIDTH)
    assert len(bands) == 1 and len(bands[0]) == 1


def test_mixed_layout_full_width_header_sidebar_then_full_width_section():
    """The genuinely new capability: a full-width header band, a 2-region
    sidebar+main body, and a full-width section afterward, all on the same
    page. The *old* single global-boundary algorithm had no way to
    represent this — everything below the header zone was forced into
    left/right for the rest of the page, with no way back out to
    full-width. This is the acceptance case for region-level (not
    whole-page) layout analysis.
    """
    is_header = _headers_named("SKILLS", "EXPERIENCE", "CERTIFICATIONS")
    lines = [
        # Full-width masthead line, spanning nearly the whole page.
        _line("Jordan Rivera — Full-Stack Engineer, available for contract work", 20, 5, x1=580),
        # Sidebar + main body (2 regions).
        _header("SKILLS", 20, 40, x1=90),
        _line("Python, Go, React, and a healthy amount of supporting detail text", 20, 60, x1=190),
        _header("EXPERIENCE", 240, 40, x1=340),
        _line("Senior Engineer — shipped several major product features over two years", 240, 60, x1=560),
        # Full-width section resuming below the split body.
        _header("CERTIFICATIONS", 20, 200, x1=580),
        _line("AWS Certified Solutions Architect, issued 2023, spanning nearly the full page width", 20, 220, x1=580),
    ]
    bands = detect_page_regions(lines, baseline=10.0, is_header_line=is_header, page_width=_PAGE_WIDTH)

    region_counts = [len(band) for band in bands]
    assert region_counts == [1, 2, 1], f"expected header band, 2-region body band, full-width band; got {region_counts}"

    # Reading order must be: masthead, then the whole SKILLS side, then the
    # whole EXPERIENCE side, then CERTIFICATIONS — not interleaved by y0.
    flat_texts = [l.text for band in bands for region in band for l in region]
    assert flat_texts.index("SKILLS") < flat_texts.index("Python, Go, React, and a healthy amount of supporting detail text")
    assert flat_texts.index("Python, Go, React, and a healthy amount of supporting detail text") < flat_texts.index("EXPERIENCE")
    assert flat_texts.index("EXPERIENCE") < flat_texts.index("CERTIFICATIONS")


def test_resolve_reading_order_processes_pages_in_order_and_flattens_bands():
    is_header = _headers_named("SKILLS", "EXPERIENCE")
    page1 = [
        _header("SKILLS", 20, 40, x1=90, page=1, order=0),
        _line("Python and friends", 20, 60, x1=150, page=1, order=1),
        _header("EXPERIENCE", 240, 40, x1=340, page=1, order=2),
        _line("Senior Engineer role description text", 240, 60, x1=560, page=1, order=3),
    ]
    page2 = [_line("continued on page two", 20, 20, x1=200, page=2, order=4)]
    lines = page1 + page2
    result = resolve_reading_order(
        lines, page_sizes={1: (_PAGE_WIDTH, 800.0), 2: (_PAGE_WIDTH, 800.0)}, baseline=10.0, is_header_line=is_header
    )
    assert [l.page for l in result] == [1, 1, 1, 1, 2]
    assert result[-1].text == "continued on page two"
    # Source order is preserved on the Line objects themselves even though
    # the returned sequence is reordered.
    assert [l.order for l in result[:4]] == [0, 1, 2, 3]
