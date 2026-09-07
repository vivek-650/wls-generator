"""Contact block extraction: name, email, phone, location.

Only ever runs against the "contact block" (lines on page 1 before the first
detected section header) — never the whole document — so template/agency
artifacts elsewhere in the file (e.g. a stray agency email near a signature
block on the last page) are never mistaken for the candidate's own details.
"""
from __future__ import annotations

import re
from typing import List, Optional

import phonenumbers
from spacy.language import Language

from ..extraction.models import Line
from .common import clean_text

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

# Default regions to try when a phone number has no explicit country code.
# Both sample fixtures (and the assignment's stated target market) are
# India-based resumes, so IN is tried first; US is a broad fallback.
_PHONE_REGIONS = ["IN", "US", None]


def _extract_email(lines: List[Line]) -> Optional[str]:
    for line in lines:
        m = _EMAIL_RE.search(line.text)
        if m:
            return m.group(0).strip().rstrip(".,;")
    return None



# Fallback for a bare 10-digit Indian mobile number wrapped in a malformed
# country-code prefix (e.g. "+8780525957" — missing the "91", so
# `phonenumbers` sees a bogus "+8" country code and refuses to parse the
# whole string even though the digits themselves are an unambiguous real
# number). Indian mobile numbers always start 6-9 and are exactly 10 digits.
_INDIAN_MOBILE_RE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?([6-9]\d{9})(?!\d)")


def _extract_phone(lines: List[Line]) -> Optional[str]:
    text = " ".join(l.text for l in lines)
    for region in _PHONE_REGIONS:
        try:
            for match in phonenumbers.PhoneNumberMatcher(text, region):
                return phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
        except Exception:
            continue
    m = _INDIAN_MOBILE_RE.search(text)
    if m:
        return f"+91 {m.group(1)}"
    return None


_TITLE_KEYWORDS = (
    "developer", "engineer", "manager", "designer", "analyst", "consultant",
    "architect", "specialist", "intern", "director", "executive", "officer",
    "lead", "administrator", "coordinator", "scientist", "programmer",
    "sr.", "jr.", "senior", "junior", "full stack", "backend", "frontend",
    "devops",
)


def _looks_like_job_title(text: str) -> bool:
    lowered = text.lower()
    return any(kw in lowered for kw in _TITLE_KEYWORDS)


def _extract_name(lines: List[Line], nlp: Language) -> Optional[str]:
    candidates = [l for l in lines if l.text.strip()]
    if not candidates:
        return None
    # The largest-font line(s) in the contact block are very likely the name
    # (resumes almost universally render the candidate's name as the biggest
    # text on the page) — this is the primary signal per the pipeline design.
    # A stylized name is sometimes split across two same-size lines stacked
    # in the *same column* (e.g. a large "ABHAY" / "ODEDRA" heading, with
    # unrelated contact-icon lines from a different column interleaved
    # between them once everything's in top-to-bottom reading order) — every
    # max-size line in the same column as the first one found is joined.
    # Two guards keep this from over-joining on a plainly-styled resume
    # with little/no font variation, where the name, tagline, and even the
    # opening of a summary paragraph can all legitimately share the
    # "biggest" size: a line whose x0 lands in a clearly different column
    # is skipped rather than ending the run (so a later same-column line
    # can still join), and the merge stops the moment it would exceed a
    # generous word budget for a real person's name.
    _NAME_X_TOLERANCE = 15.0
    _MAX_NAME_WORDS = 6

    max_size = max(l.font_size for l in candidates)
    anchor = next(l for l in candidates if l.font_size >= max_size - 0.5)
    biggest: List[Line] = []
    word_count = 0
    for l in candidates:
        if l.font_size < max_size - 0.5:
            continue
        if abs(l.x0 - anchor.x0) > _NAME_X_TOLERANCE:
            continue
        words = clean_text(l.text).split()
        if biggest and word_count + len(words) > _MAX_NAME_WORDS:
            break
        biggest.append(l)
        word_count += len(words)
    name_text = clean_text(" ".join(l.text for l in biggest))
    if not name_text:
        return None

    # spaCy PERSON NER is a *cross-check*, not an override: the small model
    # can both miss real names (unfamiliar/non-Western names) and mistag a
    # job title as PERSON, so we only let NER override the primary
    # font-size signal when the biggest line looks like a job title rather
    # than a name (e.g. "Python Developer", "Sr. iOS Developer").
    if not _looks_like_job_title(name_text):
        return name_text

    for line in candidates:
        if line in biggest:
            continue
        text = clean_text(line.text)
        if not text or "@" in text or any(ch.isdigit() for ch in text):
            continue
        if _looks_like_job_title(text):
            continue
        d = nlp(text)
        if any(ent.label_ == "PERSON" for ent in d.ents):
            return text

    # Nothing better found — fall back to the biggest-font line even though
    # it looks title-like, since it's still the best signal we have.
    return name_text



# spaCy's small model (`en_core_web_sm`) is weak on Indian place names in
# the sparse, context-free way they appear in a contact line — a lone city
# name with no surrounding sentence is exactly the case general-purpose NER
# does worst on, and it isn't just a miss: it actively mistags real cities
# as PERSON (e.g. "Noida"). A small gazetteer of major Indian
# cities/states/UTs is checked as a second, independent signal alongside
# NER — this is exactly the "hybrid" NLP + rules approach the assignment
# calls for, not a replacement for NER (which still covers everywhere
# outside this list).
_INDIAN_PLACES = {
    "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad",
    "ahmedabad", "chennai", "kolkata", "surat", "pune", "jaipur", "lucknow",
    "kanpur", "nagpur", "indore", "thane", "bhopal", "visakhapatnam",
    "patna", "vadodara", "ghaziabad", "ludhiana", "agra", "nashik",
    "faridabad", "meerut", "rajkot", "varanasi", "srinagar", "amritsar",
    "allahabad", "prayagraj", "ranchi", "coimbatore", "jabalpur", "gwalior",
    "vijayawada", "jodhpur", "madurai", "raipur", "kota", "guwahati",
    "chandigarh", "mysuru", "mysore", "gurugram", "gurgaon", "noida",
    "greater noida", "dehradun", "gandhinagar", "palsana", "surendranagar",
    "bhavnagar", "junagadh", "anand", "nadiad", "mehsana", "bharuch",
    "navsari", "valsad", "porbandar", "bhuj", "morbi", "jamnagar",
    "gujarat", "maharashtra", "karnataka", "tamil nadu", "telangana",
    "andhra pradesh", "west bengal", "uttar pradesh", "rajasthan",
    "madhya pradesh", "bihar", "kerala", "punjab", "haryana",
    "uttarakhand", "odisha", "assam", "jharkhand", "chhattisgarh",
    "goa", "himachal pradesh", "tripura", "manipur", "meghalaya",
    "nagaland", "mizoram", "sikkim", "arunachal pradesh", "india",
}


def _gazetteer_places(text: str, name_tokens: set) -> List[str]:
    lowered = text.lower()
    found = []
    # Longest phrases first ("new delhi" before "delhi") so a multi-word
    # place isn't shadowed by a shorter place name it happens to contain.
    for place in sorted(_INDIAN_PLACES, key=len, reverse=True):
        if place in name_tokens:
            continue
        if re.search(rf"(?<![a-z]){re.escape(place)}(?![a-z])", lowered):
            found.append(place.title())
            lowered = lowered.replace(place, " " * len(place))
    return found


def _extract_location(lines: List[Line], nlp: Language, name: Optional[str]) -> Optional[str]:
    text = clean_text(" ".join(l.text for l in lines))
    if not text:
        return None
    name_tokens = {t.lower() for t in (name or "").split()}
    doc = nlp(text)
    # A contact line often packs location/phone/email with only a bullet or
    # pipe glyph between them ("...India• +91...") — spaCy's tokenizer can
    # pull that glyph into the entity span itself since there's no space
    # before it, so trailing non-alphanumeric characters are stripped.
    places = [
        stripped
        for ent in doc.ents
        if ent.label_ in ("GPE", "LOC")
        and (stripped := re.sub(r"[^A-Za-z0-9)]+$", "", ent.text.strip()))
        and stripped.lower() not in name_tokens
    ]
    places.extend(_gazetteer_places(text, name_tokens))
    if not places:
        return None
    # Keep original order, dedupe, join (e.g. "Ahmedabad, Gujarat").
    seen = set()
    ordered = []
    for p in places:
        if p.lower() not in seen:
            seen.add(p.lower())
            ordered.append(p)
    return ", ".join(ordered)


def extract_contact(contact_lines: List[Line], nlp: Language) -> dict:
    name = _extract_name(contact_lines, nlp)
    return {
        "fullName": name,
        "email": _extract_email(contact_lines),
        "phone": _extract_phone(contact_lines),
        "location": _extract_location(contact_lines, nlp, name),
    }
