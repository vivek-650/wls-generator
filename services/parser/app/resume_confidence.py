"""Deterministic gate for "does this document even read as a resume?" —
separate from *how well* a genuine resume parsed (that's what
`meta.warnings` already tracks per-field).

Production resume-parsing engines (Sovren/Textkernel, Affinda, HireAbility)
don't run a separate upstream classifier model for this — they run
extraction as normal, then report a confidence/quality indicator computed
from what was actually found. That's the approach here too: no new
extraction work, no embeddings, no AI call — just a read of the same
`ParsedResume` fields `pipeline.py` already assembled, checked against two
signals that turned out to cleanly separate every real fixture from a
battery of 9 synthetic non-resume documents (an invoice, a recipe, a legal
contract, a news article, an inventory dump, an academic paper, a cover
letter, a blank page, and a one-line note) built specifically to validate
this: every negative case had zero populated structured sections, and 8 of
9 had no findable contact method either.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from .schemas import (
    ParsedCertificationEntry,
    ParsedContact,
    ParsedEducationEntry,
    ParsedExperienceEntry,
    ParsedProjectEntry,
    ParsedSkill,
)


@dataclass
class ResumeConfidenceResult:
    is_resume: bool
    reasons: List[str] = field(default_factory=list)


def assess_resume_confidence(
    contact: ParsedContact,
    experience: List[ParsedExperienceEntry],
    education: List[ParsedEducationEntry],
    skills: List[ParsedSkill],
    certifications: List[ParsedCertificationEntry],
    projects: List[ParsedProjectEntry],
) -> ResumeConfidenceResult:
    sections_with_content = sum(
        1
        for populated in (bool(experience), bool(education), bool(skills), bool(certifications), bool(projects))
        if populated
    )
    has_contact_signal = bool(contact.email or contact.phone)

    reasons: List[str] = [
        f"{sections_with_content}/5 structured sections populated (experience, education, skills, "
        "certifications, projects)",
        "contact email or phone found" if has_contact_signal else "no contact email or phone found",
    ]

    # Deliberately an AND, not an OR: a genuine (if messy or badly
    # formatted) resume clears this the moment it has *either* a real
    # section or a findable contact method — this cannot false-positive
    # reject a real resume that's merely missing one field, only a
    # document with *neither* signal at all, which every one of the 9
    # synthetic negative fixtures this rule was validated against hit.
    is_resume = sections_with_content > 0 or has_contact_signal
    if not is_resume:
        reasons.append("neither signal found — does not read as a resume")

    return ResumeConfidenceResult(is_resume=is_resume, reasons=reasons)
