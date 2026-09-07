"""Pydantic models mirroring `packages/shared-types/src/parsedResume.ts` exactly.

Field names intentionally use camelCase (not idiomatic Python/PEP8) because the
TypeScript contract requires the JSON output to match those names verbatim
(`fullName`, `isCurrent`, `startDate`, `techStack`, etc). Using camelCase as the
actual attribute name (rather than snake_case + alias) keeps the mapping
trivially obvious and avoids alias-generation bugs.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class SourceFileType(str, Enum):
    pdf = "pdf"
    docx = "docx"


class ParsedContact(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None


class ParsedExperienceEntry(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    isCurrent: bool = False
    description: List[str] = Field(default_factory=list)


class ParsedEducationEntry(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None


class ParsedCertificationEntry(BaseModel):
    name: str
    issuer: Optional[str] = None
    date: Optional[str] = None


class ParsedProjectEntry(BaseModel):
    name: str
    description: List[str] = Field(default_factory=list)
    techStack: List[str] = Field(default_factory=list)


class ParsedSkill(BaseModel):
    skill: str
    category: Optional[str] = None


class ParsedResumeMeta(BaseModel):
    parserVersion: str
    sourceFileType: SourceFileType
    warnings: List[str] = Field(default_factory=list)


class ParsedResume(BaseModel):
    contact: ParsedContact
    summary: Optional[str] = None
    skills: List[ParsedSkill] = Field(default_factory=list)
    experience: List[ParsedExperienceEntry] = Field(default_factory=list)
    education: List[ParsedEducationEntry] = Field(default_factory=list)
    certifications: List[ParsedCertificationEntry] = Field(default_factory=list)
    projects: List[ParsedProjectEntry] = Field(default_factory=list)
    meta: ParsedResumeMeta


class ErrorDetail(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
