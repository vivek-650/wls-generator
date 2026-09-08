"""Layout analysis: geometry primitives, per-page region detection, and
reading-order reconstruction. See `reading_order.resolve_reading_order` —
the one function `segmentation.py` calls into.
"""
from __future__ import annotations

from .reading_order import resolve_reading_order

__all__ = ["resolve_reading_order"]
