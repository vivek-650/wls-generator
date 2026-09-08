"""Pure geometry helpers on axis-aligned bounding boxes.

Deliberately independent of `Line`/PDF-specific concepts — every function
here operates on plain (x0, y0, x1, y1) tuples so it's testable in
isolation and reusable anywhere a bounding-box comparison is needed.
"""
from __future__ import annotations

from typing import NamedTuple


class BBox(NamedTuple):
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def width(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.y1 - self.y0)


def horizontal_gap(a: BBox, b: BBox) -> float:
    """Horizontal distance between two boxes — 0 if they overlap on x,
    otherwise the gap between the closer pair of edges. Negative inputs
    (overlap) never happen since this is always max(0, ...)."""
    if a.x1 <= b.x0:
        return b.x0 - a.x1
    if b.x1 <= a.x0:
        return a.x0 - b.x1
    return 0.0


def vertical_overlap(a: BBox, b: BBox) -> float:
    """Length of the shared y-range between two boxes, 0 if none."""
    top = max(a.y0, b.y0)
    bottom = min(a.y1, b.y1)
    return max(0.0, bottom - top)


def vertical_overlap_ratio(a: BBox, b: BBox) -> float:
    """`vertical_overlap` as a fraction of the *shorter* box's height —
    two boxes of very different heights (a whole sidebar block vs. one
    short header line) can still "substantially overlap" from the shorter
    one's perspective even though the raw overlap is far less than either
    box's own height."""
    shorter = min(a.height, b.height)
    if shorter <= 0:
        return 0.0
    return vertical_overlap(a, b) / shorter


def iou(a: BBox, b: BBox) -> float:
    """Intersection-over-union of two boxes, 0..1."""
    ix0, iy0 = max(a.x0, b.x0), max(a.y0, b.y0)
    ix1, iy1 = min(a.x1, b.x1), min(a.y1, b.y1)
    inter_w, inter_h = max(0.0, ix1 - ix0), max(0.0, iy1 - iy0)
    intersection = inter_w * inter_h
    if intersection <= 0:
        return 0.0
    union = a.width * a.height + b.width * b.height - intersection
    return intersection / union if union > 0 else 0.0


def contains(outer: BBox, inner: BBox, tolerance: float = 0.5) -> bool:
    """True if `inner` sits entirely inside `outer`, within `tolerance` pt
    of slack on each edge (bounding boxes from font-metric rounding are
    rarely pixel-exact)."""
    return (
        inner.x0 >= outer.x0 - tolerance
        and inner.y0 >= outer.y0 - tolerance
        and inner.x1 <= outer.x1 + tolerance
        and inner.y1 <= outer.y1 + tolerance
    )


def x_alignment_score(a: BBox, b: BBox, tolerance: float = 3.0) -> float:
    """1.0 if both boxes share a left edge (within `tolerance` pt) — the
    strongest "these belong to the same column" signal short of an actual
    detected region — decaying to 0.0 by 4x the tolerance. Left-edge
    alignment specifically (not centered/right) because that's what a
    genuine text column shares; a right-aligned date column shares a
    *right* edge instead, which is exactly the case this must NOT reward,
    or it would re-introduce the "right-aligned date looks like a column"
    false positive `regions.py` guards against elsewhere.
    """
    delta = abs(a.x0 - b.x0)
    if delta <= tolerance:
        return 1.0
    decay_span = tolerance * 3
    return max(0.0, 1.0 - (delta - tolerance) / decay_span)


def distance(a: BBox, b: BBox) -> float:
    """Euclidean distance between box centers — a general-purpose proximity
    measure for clustering when neither pure x nor pure y separation is
    the deciding factor on its own."""
    ax, ay = (a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2
    bx, by = (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5
