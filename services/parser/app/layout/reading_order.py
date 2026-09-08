"""Reading-order reconstruction: walk each page's bands top to bottom, and
within a band, its regions left to right, flattening `regions.py`'s output
into the single `List[Line]` the rest of the pipeline (`segmentation.py`
and every extractor) already expects.

Left-to-right within a band is the geometrically correct default for a
left-to-right document when nothing else distinguishes two regions — not a
resume-specific hardcode. `regions.py` already orders each band's regions
left-to-right (it builds "left" before "right"), so this module's job is
purely the cross-page, cross-band flattening — it never re-derives region
order itself.
"""
from __future__ import annotations

from typing import Callable, Dict, List, Optional, Tuple

from ..extraction.models import Line
from .regions import detect_page_regions


def resolve_reading_order(
    lines: List[Line],
    page_sizes: Dict[int, Tuple[float, float]],
    baseline: float,
    is_header_line: Callable[[Line, float], Optional[str]],
) -> List[Line]:
    """Reorders `lines` (in raw extraction order) into reading order.

    Each `Line`'s own `order` field (extraction/source order) is never
    touched — this returns a new list in a new sequence; source order stays
    recoverable from the `Line` objects themselves for anyone who needs it.
    """
    by_page: Dict[int, List[Line]] = {}
    for l in lines:
        by_page.setdefault(l.page, []).append(l)

    result: List[Line] = []
    for page in sorted(by_page):
        page_lines = by_page[page]
        page_width, _ = page_sizes.get(page, (0.0, 0.0))
        bands = detect_page_regions(page_lines, baseline, is_header_line, page_width)
        for band in bands:
            for region in band:
                result.extend(region)
    return result
