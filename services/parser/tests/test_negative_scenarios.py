"""Tests for the resume-confidence gate (`app/resume_confidence.py`) and the
`NotAResumeError` rejection path it drives in `parse_resume()`.

Two fixture sets, both committed (synthetic, no personal data — see the
generator scripts alongside them):
  - `negative_fixtures/` — documents that are NOT resumes at all (invoice,
    recipe, legal contract, ...). Every one must raise `NotAResumeError`.
  - `edge_case_fixtures/` — documents that ARE genuine resumes but are
    unusually sparse or unstructured. Every one must parse normally
    (no exception), guarding the gate's deliberately conservative
    AND-based threshold against ever tightening by accident.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.pipeline import NotAResumeError, UnparseableFileError, parse_resume
from app.resume_confidence import assess_resume_confidence
from app.schemas import ParsedContact, ParsedEducationEntry, ParsedSkill, SourceFileType

NEGATIVE_DIR = Path(__file__).resolve().parent / "negative_fixtures"
EDGE_CASE_DIR = Path(__file__).resolve().parent / "edge_case_fixtures"

NEGATIVE_FIXTURES = [
    "01_invoice.pdf",
    "02_recipe.pdf",
    "03_legal_contract.pdf",
    "04_news_article.pdf",
    "05_inventory_dump.pdf",
    "06_academic_paper.pdf",
    "07_cover_letter.pdf",
    "09_short_note.pdf",
]


@pytest.mark.parametrize("filename", NEGATIVE_FIXTURES)
def test_non_resume_documents_are_rejected(filename: str):
    data = (NEGATIVE_DIR / filename).read_bytes()
    with pytest.raises(NotAResumeError):
        parse_resume(data, SourceFileType.pdf)


def test_blank_page_raises_unparseable_not_not_a_resume():
    # A blank page has no extractable text at all, so it's caught one stage
    # earlier than the confidence gate — by the existing "no text found"
    # check in `parse_resume()` — and must stay `UnparseableFileError`, not
    # get relabeled `NotAResumeError` by this feature.
    data = (NEGATIVE_DIR / "08_blank_page.pdf").read_bytes()
    with pytest.raises(UnparseableFileError):
        parse_resume(data, SourceFileType.pdf)


def test_fresher_resume_with_only_education_and_skills_is_accepted():
    # Hard positive case: no Experience section at all, very short overall.
    # Must not be rejected — it has real structured sections.
    data = (EDGE_CASE_DIR / "fresher_minimal.pdf").read_bytes()
    result = parse_resume(data, SourceFileType.pdf)
    assert result.contact.fullName
    assert result.education or result.skills


def test_prose_heavy_resume_with_no_sections_is_accepted():
    # Hard positive case: one flowing paragraph, no section headers at all.
    # Segmentation may find zero structured sections here, but a real email
    # and phone are still present in the contact block, which alone must be
    # enough to accept it under the gate's OR-shaped acceptance rule.
    data = (EDGE_CASE_DIR / "prose_heavy_no_sections.pdf").read_bytes()
    result = parse_resume(data, SourceFileType.pdf)
    assert result.contact.email or result.contact.phone


def _contact(**overrides) -> ParsedContact:
    fields = {"fullName": None, "email": None, "phone": None, "location": None}
    fields.update(overrides)
    return ParsedContact(**fields)


def test_assess_resume_confidence_accepts_sections_with_no_contact_info():
    contact = _contact()
    result = assess_resume_confidence(
        contact=contact,
        experience=[],
        education=[ParsedEducationEntry(institution="IIT Roorkee", degree="B.Tech")],
        skills=[ParsedSkill(skill="Python", category=None)],
        certifications=[],
        projects=[],
    )
    assert result.is_resume


def test_assess_resume_confidence_accepts_contact_only_with_no_sections():
    contact = _contact(email="someone@example.com")
    result = assess_resume_confidence(
        contact=contact,
        experience=[],
        education=[],
        skills=[],
        certifications=[],
        projects=[],
    )
    assert result.is_resume


def test_assess_resume_confidence_rejects_neither_signal():
    contact = _contact()
    result = assess_resume_confidence(
        contact=contact,
        experience=[],
        education=[],
        skills=[],
        certifications=[],
        projects=[],
    )
    assert not result.is_resume
