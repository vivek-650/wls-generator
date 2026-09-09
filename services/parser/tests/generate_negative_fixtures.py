"""Generates the synthetic "wrong file uploaded" documents committed under
tests/negative_fixtures/ — the source of truth for those PDFs, kept so the
battery can be regenerated or extended later. Not a test itself (no
`test_` prefix, so pytest won't collect it); run directly with the venv
Python to rebuild the fixtures in place:

    .venv/Scripts/python.exe tests/generate_negative_fixtures.py

Uses PyMuPDF directly (already a project dependency) to build simple text
PDFs — no new deps. Every fixture is entirely invented text (a fake
invoice, a fake recipe, ...) with no personal data, which is why — unlike
samples/fixtures/ — these are safe to commit.
"""
import sys
from pathlib import Path

import fitz

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "negative_fixtures"
OUT.mkdir(parents=True, exist_ok=True)


def make_text_pdf(filename: str, pages_text: list[str], title_font=14, body_font=10):
    doc = fitz.open()
    for text in pages_text:
        page = doc.new_page(width=595, height=842)  # A4
        rect = fitz.Rect(50, 50, 545, 792)
        page.insert_textbox(rect, text, fontsize=body_font, fontname="helv")
    doc.save(OUT / filename)
    doc.close()
    print(f"wrote {filename}")


# 1. Invoice — structured, numeric-heavy, zero resume content
make_text_pdf(
    "01_invoice.pdf",
    [
        "INVOICE\n\n"
        "Invoice #: INV-20394\n"
        "Date: 2026-03-14\n"
        "Bill To: Meridian Logistics Pvt. Ltd.\n"
        "123 Industrial Estate, Pune, Maharashtra\n\n"
        "Description                    Qty    Unit Price    Total\n"
        "Warehouse racking system        12      4,500.00     54,000.00\n"
        "Installation labor              40 hrs    650.00      26,000.00\n"
        "Freight and handling              1      8,200.00      8,200.00\n\n"
        "Subtotal:                                          88,200.00\n"
        "GST (18%):                                          15,876.00\n"
        "Total Due:                                         104,076.00\n\n"
        "Payment Terms: Net 30 days from invoice date.\n"
        "Please remit payment to the account details below.\n"
        "Bank: HDFC Bank, Account No. 5021xxxx4433, IFSC HDFC0001234\n"
    ],
)

# 2. Recipe — prose, no personal/professional framing at all
make_text_pdf(
    "02_recipe.pdf",
    [
        "Classic Butter Chicken\n\n"
        "Serves 4 | Prep time: 20 minutes | Cook time: 40 minutes\n\n"
        "Ingredients:\n"
        "500g boneless chicken thighs, cubed\n"
        "1 cup plain yogurt\n"
        "2 tbsp ginger-garlic paste\n"
        "1 tsp turmeric powder\n"
        "2 tbsp butter\n"
        "1 cup tomato puree\n"
        "1/2 cup heavy cream\n"
        "1 tsp garam masala\n"
        "Salt to taste\n\n"
        "Instructions:\n"
        "1. Marinate the chicken in yogurt, ginger-garlic paste, turmeric, and salt for at least 2 hours.\n"
        "2. Grill or pan-sear the chicken until charred at the edges, then set aside.\n"
        "3. Melt butter in a pan, add tomato puree, and simmer for 10 minutes.\n"
        "4. Stir in cream and garam masala, then add the cooked chicken.\n"
        "5. Simmer for another 10 minutes and serve hot with naan or rice.\n"
    ],
)

# 3. Legal contract — dense paragraphs, formal/legal register
make_text_pdf(
    "03_legal_contract.pdf",
    [
        "SOFTWARE LICENSE AGREEMENT\n\n"
        "This Software License Agreement (\"Agreement\") is entered into as of the Effective Date "
        "by and between Northbridge Technologies Inc. (\"Licensor\") and the entity identified in the "
        "signature block below (\"Licensee\").\n\n"
        "WHEREAS, Licensor owns certain proprietary software and related documentation; and\n"
        "WHEREAS, Licensee desires to obtain, and Licensor desires to grant, a limited license to use "
        "such software subject to the terms and conditions set forth herein;\n\n"
        "NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties agree "
        "as follows:\n\n"
        "1. GRANT OF LICENSE. Subject to the terms of this Agreement, Licensor hereby grants to Licensee "
        "a non-exclusive, non-transferable license to use the Software solely for Licensee's internal "
        "business purposes.\n\n"
        "2. TERM AND TERMINATION. This Agreement shall commence on the Effective Date and continue for "
        "a period of twelve (12) months unless earlier terminated in accordance with this Section.\n\n"
        "3. LIMITATION OF LIABILITY. IN NO EVENT SHALL LICENSOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, "
        "SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT.\n"
    ],
)

# 4. News/blog article — prose with headings, but not resume-shaped
make_text_pdf(
    "04_news_article.pdf",
    [
        "Local Startup Raises $4M Series A to Expand Logistics Platform\n\n"
        "By Priya Nair | March 12, 2026\n\n"
        "A Bengaluru-based logistics startup announced Wednesday it has closed a $4 million Series A "
        "funding round led by Orbit Ventures, with participation from several angel investors.\n\n"
        "The company, which builds route-optimization software for last-mile delivery fleets, said it "
        "plans to use the funding to expand its engineering team and enter three new metro markets by "
        "the end of the year.\n\n"
        "\"We've seen strong demand from mid-sized logistics operators who can't afford enterprise "
        "software but have outgrown spreadsheets,\" the company's co-founder said in a statement.\n\n"
        "The funding round brings the company's total raised to $5.2 million since its founding in 2023.\n"
    ],
)

# 5. Spreadsheet-style tabular dump — rows/columns of unrelated data
make_text_pdf(
    "05_inventory_dump.pdf",
    [
        "WAREHOUSE INVENTORY REPORT — Q1 2026\n\n"
        "SKU        Product Name                Location    Qty On Hand   Reorder Level\n"
        "A1023      Steel Bracket 4in           Rack A-12        340           100\n"
        "A1024      Steel Bracket 6in           Rack A-13        180            80\n"
        "B2045      Hex Bolt M8x40              Rack B-04       2200           500\n"
        "B2046      Hex Bolt M10x50             Rack B-05       1450           400\n"
        "C3012      Rubber Gasket Set           Rack C-19        620           150\n"
        "C3013      Rubber Gasket Set XL        Rack C-20        310            90\n"
        "D4001      Cardboard Box Small         Rack D-01       5400          1000\n"
        "D4002      Cardboard Box Large         Rack D-02       2100           500\n\n"
        "Total SKUs: 8   |   Total Units: 12,600   |   Generated: 2026-03-01\n"
    ],
)

# 6. Academic paper — HAS section-like headers (Abstract, Introduction,
# Methodology, References), a tricky edge case for content-based classifiers.
make_text_pdf(
    "06_academic_paper.pdf",
    [
        "Efficient Approximation Algorithms for Sparse Graph Partitioning\n\n"
        "ABSTRACT\n"
        "We present a new approximation algorithm for the sparse graph partitioning problem that "
        "achieves a 1.8x speedup over prior work while maintaining comparable partition quality on "
        "large-scale synthetic and real-world graphs.\n\n"
        "INTRODUCTION\n"
        "Graph partitioning is a fundamental problem in combinatorial optimization with applications "
        "spanning parallel computing, VLSI design, and social network analysis. Prior approaches have "
        "generally traded off partition quality against runtime.\n\n"
        "METHODOLOGY\n"
        "Our algorithm proceeds in three stages: coarsening, initial partitioning, and refinement. We "
        "introduce a novel edge-contraction heuristic that reduces the coarsened graph size by 40% "
        "relative to standard heavy-edge matching.\n\n"
        "RESULTS\n"
        "Across a benchmark suite of 24 graphs ranging from 10K to 50M vertices, our method achieved "
        "an average edge-cut reduction of 6.2% with a 1.8x wall-clock speedup.\n\n"
        "REFERENCES\n"
        "[1] Karypis, G., Kumar, V. A fast and high quality multilevel scheme for partitioning "
        "irregular graphs. SIAM Journal on Scientific Computing, 1998.\n"
        "[2] Hendrickson, B., Leland, R. A multilevel algorithm for partitioning graphs. SC, 1995.\n"
    ],
)

# 7. Cover letter — personal/professional prose, greeting + signature, but
# genuinely not a resume (a common real "wrong file" upload).
make_text_pdf(
    "07_cover_letter.pdf",
    [
        "Dear Hiring Manager,\n\n"
        "I am writing to express my interest in the Senior Product Manager position advertised on your "
        "careers page. With over six years of experience leading cross-functional product teams in the "
        "fintech space, I believe I would be a strong addition to your organization.\n\n"
        "In my current role, I have driven the launch of three major product lines, each achieving "
        "double-digit revenue growth within their first year. I am particularly drawn to your company's "
        "mission of expanding financial access to underserved communities, and I would welcome the "
        "opportunity to bring my experience in payments infrastructure to that goal.\n\n"
        "I have attached my resume for your review and would be delighted to discuss how my background "
        "aligns with your team's needs. Thank you for considering my application.\n\n"
        "Warm regards,\n"
        "Priya Sharma\n"
    ],
)

# 8. Blank / near-empty page — a scanned-image-style upload with no
# extractable text layer at all (simulated here as a genuinely empty page,
# since synthesizing a real scanned image is out of scope for this check).
doc = fitz.open()
doc.new_page(width=595, height=842)
doc.save(OUT / "08_blank_page.pdf")
doc.close()
print("wrote 08_blank_page.pdf")

# 9. Extremely short note — far below any reasonable resume length
make_text_pdf("09_short_note.pdf", ["Please see attached file for details.\n\nThanks,\nR."])

print("done")
