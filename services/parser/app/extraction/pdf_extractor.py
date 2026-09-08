"""PyMuPDF (fitz) based PDF text + layout extraction.

Pulls text spans with font size / bold flag / position / page number, then
collapses spans into `Line` records (one per visual line, joining spans that
sit on the same baseline).
"""
from __future__ import annotations

from typing import Dict, List, Tuple

import fitz  # PyMuPDF

from .models import ExtractedTable, Line

# PyMuPDF span "flags" is a bitfield; bit 4 (value 16) indicates bold.
_BOLD_FLAG = 1 << 4


def _span_is_bold(span: dict) -> bool:
    if span.get("flags", 0) & _BOLD_FLAG:
        return True
    font_name = (span.get("font") or "").lower()
    return "bold" in font_name


def extract_lines(file_bytes: bytes) -> List[Line]:
    """Parse a PDF byte string into an ordered list of `Line` objects.

    Raises `fitz.FileDataError` / `ValueError` if the bytes are not a valid PDF
    (the caller is expected to translate that into a 422).
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        lines: List[Line] = []
        order = 0
        for page_index in range(doc.page_count):
            page = doc[page_index]
            page_dict = page.get_text("dict")
            for block_index, block in enumerate(page_dict.get("blocks", [])):
                if block.get("type") != 0:  # 0 = text block, 1 = image
                    continue
                for raw_line in block.get("lines", []):
                    spans = raw_line.get("spans", [])
                    text = "".join(s.get("text", "") for s in spans).strip()
                    if not text:
                        continue
                    sizes = [s.get("size", 0.0) for s in spans if s.get("text", "").strip()]
                    max_size = max(sizes) if sizes else 0.0
                    bold_chars = sum(
                        len(s.get("text", "")) for s in spans if _span_is_bold(s) and s.get("text", "").strip()
                    )
                    total_chars = sum(len(s.get("text", "")) for s in spans if s.get("text", "").strip())
                    is_bold = total_chars > 0 and (bold_chars / total_chars) >= 0.5
                    bbox = raw_line.get("bbox", [0.0, 0.0, 0.0, 0.0])
                    lines.append(
                        Line(
                            text=text,
                            page=page_index + 1,
                            order=order,
                            font_size=round(max_size, 2),
                            bold=is_bold,
                            x0=bbox[0],
                            y0=bbox[1],
                            x1=bbox[2],
                            y1=bbox[3],
                            # Native PyMuPDF block grouping — a real structural signal
                            # (several visual lines the PDF producer itself grouped
                            # together) that region detection in app/layout/ builds on,
                            # rather than re-deriving block boundaries from scratch.
                            # Namespaced by page so block 0 on page 2 never collides
                            # with block 0 on page 1.
                            block_id=page_index * 100000 + block_index,
                        )
                    )
                    order += 1
        return lines
    finally:
        doc.close()


def extract_page_sizes(file_bytes: bytes) -> Dict[int, Tuple[float, float]]:
    """Return {1-indexed page number: (width, height)} for every page.

    Region detection (app/layout/regions.py) needs this to reason in
    *relative* terms — "this block spans most of the page width" implies a
    full-width region — rather than only absolute point gaps, which don't
    generalize across page sizes/orientations.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        return {i + 1: (doc[i].rect.width, doc[i].rect.height) for i in range(doc.page_count)}
    finally:
        doc.close()


def extract_tables(file_bytes: bytes) -> List[ExtractedTable]:
    """Detect genuine ruling-line tables via PyMuPDF's `find_tables()`.

    This only finds tables the PDF actually draws grid lines for — many
    resume templates render a "table-look" skills section with whitespace
    alignment alone, which this won't catch (that's what the line-based
    `_segment_by_category` heuristic in `extractors/skills.py` is for).
    Where a real table *is* found, though, its row/column structure is
    unambiguous — no guessing which line is a category label required.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        tables: List[ExtractedTable] = []
        for page_index in range(doc.page_count):
            page = doc[page_index]
            for table in page.find_tables().tables:
                try:
                    raw_rows = table.extract()
                except Exception:  # noqa: BLE001 - a malformed table shouldn't fail the whole parse
                    continue
                rows = [[clean_cell(c) for c in row] for row in raw_rows]
                rows = [row for row in rows if any(row)]
                if rows:
                    tables.append(ExtractedTable(page=page_index + 1, rows=rows))
        return tables
    finally:
        doc.close()


def clean_cell(cell: object) -> str:
    return " ".join(str(cell or "").split()).strip()