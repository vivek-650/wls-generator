"""Generates the two hard *positive* fixtures committed under
tests/edge_case_fixtures/ — genuine (if unusually sparse or unstructured)
resumes that the resume-confidence gate (resume_confidence.py) must NOT
reject, so the conservative threshold there can't tighten by accident
without a test noticing. Entirely invented content, no personal data —
safe to commit, same reasoning as generate_negative_fixtures.py.

Rebuild in place with:
    .venv/Scripts/python.exe tests/generate_edge_case_fixtures.py
"""
from pathlib import Path

import fitz

OUT = Path(__file__).resolve().parent / "edge_case_fixtures"
OUT.mkdir(parents=True, exist_ok=True)


def make_text_pdf(filename: str, text: str, body_font=10):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_textbox(fitz.Rect(50, 50, 545, 792), text, fontsize=body_font, fontname="helv")
    doc.save(OUT / filename)
    doc.close()
    print(f"wrote {filename}")


# A fresh-graduate resume with only Education + Skills — no Experience
# section at all, and very short overall. Must still be accepted: it has
# real sections (education, skills) even though there are only two of them
# and no work history.
make_text_pdf(
    "fresher_minimal.pdf",
    "Ananya Verma\n"
    "ananya.verma@example.com | +91 90000 12345\n\n"
    "EDUCATION\n"
    "B.Tech in Computer Science, IIT Roorkee, 2022 - 2026\n\n"
    "SKILLS\n"
    "Python, Java, SQL, Git\n",
)

# A resume that's entirely one flowing paragraph with no section headers
# and no bullet structure at all — segmentation finds zero sections here
# (everything stays in the pre-header contact block), so this is the case
# that specifically exercises the confidence gate's OR: no structured
# sections, but a real email and phone number are still findable in the
# prose, which alone must be enough to accept it.
make_text_pdf(
    "prose_heavy_no_sections.pdf",
    "Rohan Mehta\n"
    "Email: rohan.mehta@example.com Phone: +91 98765 43210\n\n"
    "I am a software engineer with five years of experience building web applications using React "
    "and Node.js. I have worked at three different startups where I led small engineering teams and "
    "shipped products used by millions of users. I hold a bachelor's degree in computer science from "
    "Delhi University. I am skilled in JavaScript, Python, and cloud infrastructure. I am passionate "
    "about mentoring junior engineers and writing clean, maintainable code.\n",
)

print("done")
