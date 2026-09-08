"""Common in-memory representation shared by the PDF and DOCX extractors.

Both extractors normalize their source format down to a flat list of `Line`
objects so everything downstream (segmentation, section extractors) can stay
format-agnostic.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class ExtractedTable:
    """A genuine table found in the source document (PDF ruling-line table
    via PyMuPDF's `find_tables()`, or a native DOCX table object) — a far
    more reliable structural signal than inferring row/column shape from
    line-level bold/font heuristics, wherever the source actually drew one.
    """

    page: int             # 1-indexed (PDF); always 1 for DOCX
    rows: List[List[str]]  # each row's cell text, in document order


@dataclass
class Line:
    text: str
    page: int          # 1-indexed page number (PDF); always 1 for DOCX (no page concept)
    order: int          # global *extraction* order, stable across the whole document —
                          # never overwritten by layout/reading-order reconstruction (see
                          # app/layout/), so source order and reading order stay distinct.
    font_size: float     # max span font size on this line (PDF); synthetic for DOCX
    bold: bool           # True if a majority of the line's text is bold
    x0: float = 0.0        # left position (PDF layout; 0 for DOCX)
    y0: float = 0.0        # top position (PDF layout; 0 for DOCX)
    x1: float = 0.0        # right position (PDF layout; 0 for DOCX) — bbox end, needed
                             # for width/vertical-overlap/IoU in app/layout/geometry.py
    y1: float = 0.0        # bottom position (PDF layout; 0 for DOCX)
    block_id: int = 0      # native PyMuPDF block index this line belongs to (PDF); for
                             # DOCX, equal to `order` — each paragraph is structurally its
                             # own block, not a fabricated coordinate.

    @property
    def normalized(self) -> str:
        return " ".join(self.text.split()).strip().lower()

    @property
    def has_position(self) -> bool:
        """False for every DOCX line (no page/x/y concept at all) and the rare PDF line
        PyMuPDF reports at the literal origin — the existing sentinel for "position
        unknown" used throughout segmentation.py and app/layout/."""
        return self.x0 != 0.0 or self.y0 != 0.0
