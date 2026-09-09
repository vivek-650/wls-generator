"""Orchestrates the full parsing pipeline: extract -> segment -> extract
sections -> assemble `ParsedResume`.

Kept deliberately thin — all the real logic lives in `extraction/`,
`segmentation.py`, and `extractors/`. This module just wires them together
in the order described in `docs/architecture.md` ("Parsing pipeline
design").
"""
from __future__ import annotations

from typing import List, Optional

import spacy
from spacy.language import Language

from .extraction import docx_extractor, pdf_extractor
from .extraction.models import Line
from .extractors.certifications import extract_certifications
from .extractors.contact import extract_contact
from .extractors.education import extract_education
from .extractors.experience import extract_experience
from .extractors.projects import extract_projects
from .extractors.skills import SkillMatcher, extract_skills
from .extractors.summary import extract_implicit_summary, extract_summary
from .resume_confidence import assess_resume_confidence
from .schemas import ParsedResume, ParsedResumeMeta, SourceFileType
from .segmentation import segment

PARSER_VERSION = "0.1.0"

_nlp: Optional[Language] = None
_skill_matcher: Optional[SkillMatcher] = None


class UnparseableFileError(Exception):
    """Raised when the uploaded file cannot be parsed at all (wrong type,
    corrupt, empty). The API layer turns this into a 422."""


class NotAResumeError(Exception):
    """Raised when the file parsed cleanly but doesn't read as a resume at
    all (see resume_confidence.py) — a different failure mode from
    `UnparseableFileError` (we read the file fine; it's just not a
    resume), kept as its own class so server-side logs/metrics can tell
    the two apart, even though both map to the same 422 response.

    `str(exc)` is the short, user-facing message (shown directly in the
    upload UI); `.reasons` carries the detailed, per-signal diagnostic
    trail (see resume_confidence.py) for server-side logs only — keeping
    the two separate means the banner the candidate-uploader sees doesn't
    read like a debug dump.
    """

    def __init__(self, message: str, reasons: Optional[List[str]] = None) -> None:
        super().__init__(message)
        self.reasons: List[str] = reasons or []


def _get_nlp() -> Language:
    global _nlp
    if _nlp is None:
        # en_core_web_sm deliberately: it's enough for PERSON/GPE/LOC NER
        # (all we need it for) while keeping the install lightweight — see
        # README "Design trade-offs".
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def _get_skill_matcher() -> SkillMatcher:
    global _skill_matcher
    if _skill_matcher is None:
        _skill_matcher = SkillMatcher(_get_nlp())
    return _skill_matcher


def _section(sections: List[tuple], name: str) -> List[Line]:
    # Concatenates *every* block matching this canonical name, not just the
    # first. Section headers are ideally detected exactly once each, but if
    # segmentation ever double-fires on the same section (e.g. a bold
    # skills-category label loosely resembling another header's wording),
    # silently returning only the first block would silently drop the rest
    # of that section's content rather than degrading gracefully.
    merged: List[Line] = []
    for canonical, lines in sections:
        if canonical == name:
            merged.extend(lines)
    return merged


def parse_resume(file_bytes: bytes, source_file_type: SourceFileType) -> ParsedResume:
    if not file_bytes:
        raise UnparseableFileError("Uploaded file is empty.")

    try:
        if source_file_type == SourceFileType.pdf:
            lines = pdf_extractor.extract_lines(file_bytes)
            tables = pdf_extractor.extract_tables(file_bytes)
            page_sizes = pdf_extractor.extract_page_sizes(file_bytes)
        elif source_file_type == SourceFileType.docx:
            lines = docx_extractor.extract_lines(file_bytes)
            tables = docx_extractor.extract_tables(file_bytes)
            page_sizes = {}
        else:
            raise UnparseableFileError(f"Unsupported file type: {source_file_type}")
    except UnparseableFileError:
        raise
    except Exception as exc:  # noqa: BLE001 - translate any parser-library failure into a 422
        # Plain, user-facing message — the raw library exception (`exc`) is
        # too technical to show whoever just uploaded the file, but it's
        # preserved via `from exc` so main.py can still log it.
        raise UnparseableFileError(
            f"We couldn't read this {source_file_type.value.upper()} file. It may be corrupted or damaged — "
            "please try re-saving and uploading it again."
        ) from exc

    if not lines:
        raise UnparseableFileError("No extractable text found in the uploaded file.")

    warnings: List[str] = []

    nlp = _get_nlp()
    matcher = _get_skill_matcher()

    seg = segment(lines, page_sizes, matcher)

    contact = extract_contact(seg.contact_lines, nlp)
    if not contact["fullName"]:
        warnings.append("no candidate name detected")
    if not contact["email"]:
        warnings.append("no email detected")
    if not contact["phone"]:
        warnings.append("no phone detected")
    if not contact["location"]:
        warnings.append("no location detected")

    summary_lines = _section(seg.sections, "summary")
    summary = extract_summary(summary_lines)
    if not summary:
        summary = extract_implicit_summary(seg.contact_lines, contact)
    if not summary:
        warnings.append("no professional summary detected")

    skills_lines = _section(seg.sections, "skills")
    skill_pairs = extract_skills(matcher, skills_lines, lines, tables)
    skills = [{"skill": s, "category": c} for s, c in skill_pairs]
    if not skills:
        warnings.append("no skills detected")

    experience_lines = _section(seg.sections, "experience")
    experience = extract_experience(experience_lines)
    if experience_lines and not experience:
        warnings.append("experience section found but no entries could be split out")

    education_lines = _section(seg.sections, "education")
    education = extract_education(education_lines)
    if education_lines and not education:
        warnings.append("education section found but no entries could be split out")

    certification_lines = _section(seg.sections, "certifications")
    certifications = extract_certifications(certification_lines)

    project_lines = _section(seg.sections, "projects")
    projects = extract_projects(project_lines)

    result = ParsedResume(
        contact=contact,
        summary=summary,
        skills=skills,
        experience=experience,
        education=education,
        certifications=certifications,
        projects=projects,
        meta=ParsedResumeMeta(
            parserVersion=PARSER_VERSION,
            sourceFileType=source_file_type,
            warnings=warnings,
        ),
    )

    # Every extraction stage has now run — this is the cheapest, most
    # information-rich point to ask "does this actually read as a resume at
    # all?" (see resume_confidence.py). A document that isn't a resume at
    # all is a different failure mode from one we simply couldn't read, so
    # it's a distinct exception even though both map to the same 422 —
    # worth keeping separate server-side for logging/metrics.
    confidence = assess_resume_confidence(
        result.contact, result.experience, result.education, result.skills, result.certifications, result.projects
    )
    if not confidence.is_resume:
        raise NotAResumeError(
            # Short and plain on purpose — this is read by whoever just
            # uploaded the wrong file, not a developer. The full per-signal
            # breakdown still goes out on `.reasons` for the server log.
            "This doesn't look like a resume. Please upload a resume file and try again.",
            reasons=confidence.reasons,
        )

    return result
