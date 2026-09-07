"""End-to-end pipeline tests.

Two kinds of fixtures:
  - Real resumes in `samples/fixtures/` (`.gitignore`d, personal data) —
    kept locally at the discretion of whoever's working in this repo, not
    assumed to always be present; their tests skip gracefully if absent.
    Assertions are based on what's actually in the files (verified by
    manual inspection while building the extractors), not on literal
    ground-truth values guessed in advance — see comments per assertion.
  - Synthetic, fictional fixtures under `tests/synthetic/` — no privacy
    concern, always present, exercise conventions (e.g. a DOCX with a real
    table) the real fixtures on hand at any given time might not.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.pipeline import parse_resume
from app.schemas import ParsedResume, SourceFileType

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "samples" / "fixtures"
IOS_RESUME = FIXTURES_DIR / "ios-developer-resume.pdf"
PYTHON_RESUME = FIXTURES_DIR / "python-developer-resume.pdf"
FULLSTACK_RESUME = FIXTURES_DIR / "vivek-anand-resume.pdf"
TWO_COLUMN_RESUME = FIXTURES_DIR / "two-column-resume.pdf"

SYNTHETIC_DIR = Path(__file__).resolve().parent / "synthetic"
SYNTHETIC_DOCX_RESUME = SYNTHETIC_DIR / "synthetic-docx-resume.docx"


def _parse(path: Path, source_file_type: SourceFileType = SourceFileType.pdf) -> ParsedResume:
    if not path.exists():
        pytest.skip(f"fixture not present (expected, not committed): {path.name}")
    return parse_resume(path.read_bytes(), source_file_type)


@pytest.fixture(scope="module")
def ios_result() -> ParsedResume:
    return _parse(IOS_RESUME)


@pytest.fixture(scope="module")
def python_result() -> ParsedResume:
    return _parse(PYTHON_RESUME)


@pytest.fixture(scope="module")
def fullstack_result() -> ParsedResume:
    return _parse(FULLSTACK_RESUME)


@pytest.fixture(scope="module")
def two_column_result() -> ParsedResume:
    return _parse(TWO_COLUMN_RESUME)


# --- iOS developer resume (Ghoshit Vora) --------------------------------


def test_ios_contact_name(ios_result: ParsedResume):
    assert ios_result.contact.fullName
    assert "vora" in ios_result.contact.fullName.lower()


def test_ios_summary_present(ios_result: ParsedResume):
    assert ios_result.summary
    assert "ios" in ios_result.summary.lower()


def test_ios_skills_contain_known_terms(ios_result: ParsedResume):
    skill_names = {s.skill.lower() for s in ios_result.skills}
    expected = {
        "swift", "swiftui", "objective-c", "react native", "combine",
        "core animation", "uikit", "mvvm", "mvc", "clean architecture",
        "core data", "sqlite", "rest apis", "xcode", "git", "github",
        "xctest", "firebase crashlytics", "sentry", "ble", "apns", "fcm",
    }
    matched = expected & skill_names
    # Real-world extraction is never 100% — assert a strong majority match
    # rather than every single one, so the test isn't brittle to reasonable
    # taxonomy/matching tweaks.
    assert len(matched) >= 15, f"only matched {sorted(matched)} out of {sorted(expected)}"


def test_ios_projects_extracted(ios_result: ParsedResume):
    project_names = " | ".join(p.name for p in ios_result.projects).lower()
    for expected_name in ["waypoint protect", "vc connect", "goals.com"]:
        assert expected_name in project_names
    # Each extracted project should carry at least some description text.
    assert all(p.description for p in ios_result.projects)


def test_ios_declaration_dropped(ios_result: ParsedResume):
    # "Declaration" is a signature block, not resume content — nothing in
    # the parsed output should include the boilerplate declaration sentence.
    haystack = " ".join(
        [ios_result.summary or ""]
        + [d for p in ios_result.projects for d in p.description]
    ).lower()
    assert "hereby declare" not in haystack


def test_ios_no_experience_section_in_source(ios_result: ParsedResume):
    # This fixture genuinely has no dedicated "Experience" section (verified
    # by inspecting the raw extracted text) — an empty list is the correct,
    # honest output here, not a parser failure.
    assert ios_result.experience == []


# --- Python developer resume (Chintan Patel) ----------------------------


def test_python_contact_name(python_result: ParsedResume):
    assert python_result.contact.fullName
    assert "patel" in python_result.contact.fullName.lower()


def test_python_skills_contain_known_terms(python_result: ParsedResume):
    skill_names = {s.skill.lower() for s in python_result.skills}
    expected = {
        "python", "go", "java", "kotlin", "php", "django", "fastapi",
        "mysql", "sqlite", "aws", "azure", "rest apis", "microservices",
        "github",
    }
    matched = expected & skill_names
    assert len(matched) >= 10, f"only matched {sorted(matched)} out of {sorted(expected)}"


def test_python_experience_nonempty(python_result: ParsedResume):
    assert python_result.experience
    companies = [e.company or "" for e in python_result.experience]
    assert any("amri" in c.lower() for c in companies)


def test_python_experience_amri_entry(python_result: ParsedResume):
    amri = next(e for e in python_result.experience if e.company and "amri" in e.company.lower())
    assert amri.startDate == "2023-08"
    assert amri.isCurrent is True
    assert amri.endDate is None
    assert amri.description  # at least one bullet captured


def test_python_experience_all_companies_found(python_result: ParsedResume):
    companies = {(e.company or "").lower() for e in python_result.experience}
    for expected in ["amri systems", "ishtech solution", "praxware"]:
        assert any(expected in c for c in companies), f"missing company {expected}"


def test_python_education_extracted(python_result: ParsedResume):
    assert python_result.education
    institutions = " ".join((e.institution or "") for e in python_result.education).lower()
    assert "gtu" in institutions


def test_python_projects_extracted(python_result: ParsedResume):
    project_names = " | ".join(p.name for p in python_result.projects).lower()
    for expected_name in ["hearing management system", "logistics portal microservices"]:
        assert expected_name in project_names


def test_python_contact_email_not_the_stray_agency_address(python_result: ParsedResume):
    # The fixture has a stray "vivek.lumoslogic@gmail.com" printed near the
    # very end, after the Declaration block — a template/agency artifact,
    # not the candidate's own email. The contact block is only ever read
    # from the top of page 1, so it must never surface here.
    assert python_result.contact.email != "vivek.lumoslogic@gmail.com"


# --- Shared meta/contract checks ----------------------------------------


@pytest.mark.parametrize("result_fixture", ["ios_result", "python_result"])
def test_meta_fields(result_fixture: str, request: pytest.FixtureRequest):
    result: ParsedResume = request.getfixturevalue(result_fixture)
    assert result.meta.sourceFileType == SourceFileType.pdf
    assert result.meta.parserVersion
    assert isinstance(result.meta.warnings, list)
    # Neither fixture actually contains an email/phone in the source text
    # (verified by inspecting the raw PDF text) — both should be warned
    # about rather than silently null with no explanation.
    assert "no email detected" in result.meta.warnings
    assert "no phone detected" in result.meta.warnings


# --- Full-stack resume (Vivek Anand) ------------------------------------
# This fixture uses a different visual convention than the other two: the
# job *title* is bold rather than the company, at the same font size, and
# education entries carry a bold institution + a second bold location line
# followed by a plain "Degree in Field" line — both regressions this file
# guards against were reproduced and fixed against this exact file.


def test_fullstack_experience_company_and_title_both_captured(fullstack_result: ParsedResume):
    # Regression: when only the title (not the company) is bold at the same
    # font size, the old backward-walk required boldness to even collect a
    # line, so it collected neither and both fields came back null.
    assert fullstack_result.experience
    for entry in fullstack_result.experience:
        assert entry.company, f"missing company on entry titled {entry.title!r}"
        assert entry.title, f"missing title on entry at {entry.company!r}"


def test_fullstack_experience_descriptions_dont_leak_next_entry(fullstack_result: ParsedResume):
    # Regression: the unrecognized plain company line used to fall through
    # into the *previous* entry's description instead of being consumed as
    # a label line for its own entry.
    companies = {(e.company or "").lower() for e in fullstack_result.experience}
    for expected in ["waegoo", "asan innovators", "escenems"]:
        assert any(expected in c for c in companies), f"missing company {expected}"
    for entry in fullstack_result.experience:
        description_text = " ".join(entry.description).lower()
        for other_title in ("frontend developer intern", "software developer intern"):
            # A title string should only ever appear in the description of
            # the entry it belongs to reappearing as prose, never bleed from
            # a different entry's label line into this one's bullets.
            if other_title == (entry.title or "").lower():
                continue
            assert other_title not in description_text, (
                f"entry {entry.company!r} description leaked another entry's title: {description_text!r}"
            )


def test_fullstack_skills_full_recall_beyond_taxonomy(fullstack_result: ParsedResume):
    # Regression: this fixture's Skills section is "Category: item, item"
    # inline lists, and lists tools (Langraph, QdrantDB, OpenAI Agent SDK,
    # Microsoft Clarity, ...) no static taxonomy will ever fully contain.
    # Verbatim list extraction must recover all of them, not just the
    # subset that happens to already be in our curated taxonomy.
    skill_names = {s.skill.lower() for s in fullstack_result.skills}
    expected = {
        "javascript", "typescript", "c++", "next.js", "react.js", "redux",
        "node.js", "express.js", "tailwindcss", "framer motion", "mongodb",
        "mysql", "supabase", "neondb", "prisma", "mongoose", "qdrantdb",
        "pinecone db", "aws", "git", "github", "postman", "firebase",
        "clerk", "microsoft clarity", "langchain", "langraph",
        "openai agent sdk",
    }
    missing = expected - skill_names
    assert not missing, f"missing skills not covered by the static taxonomy: {sorted(missing)}"


def test_fullstack_skills_preserve_source_categories(fullstack_result: ParsedResume):
    # The resume's own category labels ("Frameworks and Libraries", "Gen
    # AI", ...) should be used directly, not remapped into the taxonomy's
    # own category names.
    categories = {(s.category or "").lower() for s in fullstack_result.skills}
    assert "gen ai" in categories
    assert "database and orms" in categories


def test_fullstack_projects_extracted_with_inline_tech_stack(fullstack_result: ParsedResume):
    # Regression: this fixture packs name + "- Link" + tech stack onto one
    # long bold line rather than a short title + separate "|" bullet line;
    # the old 70-char title-line length cap silently dropped the whole
    # Projects section.
    project_names = {p.name.lower() for p in fullstack_result.projects}
    for expected_name in ["samvad ai", "askly ai", "skill nest"]:
        assert expected_name in project_names, f"missing project {expected_name}"
    samvad = next(p for p in fullstack_result.projects if p.name.lower() == "samvad ai")
    assert "next.js" in [t.lower() for t in samvad.techStack]
    assert samvad.description  # bullets still captured, not swallowed into the title


def test_fullstack_education_institution_and_degree_not_swapped(fullstack_result: ParsedResume):
    # Regression: institution/degree/location got shuffled when an entry has
    # two label lines (institution + a bold location line) rather than the
    # single-bold-degree-line convention the extractor originally assumed.
    assert len(fullstack_result.education) >= 2
    by_institution = {(e.institution or "").lower(): e for e in fullstack_result.education}
    assert any("asansol engineering college" in k for k in by_institution)
    entry = next(e for k, e in by_institution.items() if "asansol engineering college" in k)
    assert entry.degree and "bachelor" in entry.degree.lower()
    assert entry.field and "computer science" in entry.field.lower()
    # The location line ("Asansol, West Bengal, India") must not have ended
    # up in institution or degree.
    assert "west bengal" not in (entry.institution or "").lower()
    assert "west bengal" not in (entry.degree or "").lower()


# --- Synthetic DOCX (Jane Doe, fictional) -------------------------------
# Exercises DOCX-specific paths the PDF fixtures can't: a real DOCX table
# (`document.tables`, not PDF ruling-line detection), and a resume where
# company/title share the *exact* same synthetic font size (DOCX has no
# native per-paragraph size unless a Heading style or explicit run size is
# set) with only boldness differing — the case that first exposed the
# backward-walk-finds-nothing bug in `extract_experience`.


@pytest.fixture(scope="module")
def synthetic_docx_result() -> ParsedResume:
    return _parse(SYNTHETIC_DOCX_RESUME, SourceFileType.docx)


def test_synthetic_docx_table_skills_use_source_categories(synthetic_docx_result: ParsedResume):
    # Regression: document.paragraphs and document.tables used to be walked
    # as two separate passes, silently moving the table's content (and
    # thus the whole Skills section) to the very end of the document
    # regardless of where it actually sits — corrupting segmentation
    # entirely. Table-based extraction should also win over taxonomy
    # matching, preserving the source's own category labels ("Languages",
    # "Cloud") rather than the taxonomy's ("Languages & Frameworks", ...).
    by_skill = {s.skill.lower(): s.category for s in synthetic_docx_result.skills}
    assert by_skill.get("go") == "Languages"
    assert by_skill.get("rust") == "Languages"
    assert by_skill.get("kubernetes") == "Cloud"


def test_synthetic_docx_experience_company_and_title_captured(synthetic_docx_result: ParsedResume):
    # Regression: when neither label line clears the bold/size bar (both
    # collapse to the same synthetic DOCX font size, only one is bold),
    # the backward walk used to break on the very first line it checked
    # and return zero label lines — company and title both null — rather
    # than falling back to just taking the lines immediately above the date.
    assert len(synthetic_docx_result.experience) == 1
    entry = synthetic_docx_result.experience[0]
    assert entry.company == "Initech"
    assert entry.title == "Senior Backend Engineer"
    assert entry.startDate == "2021-03"
    assert entry.isCurrent is True


def test_synthetic_docx_education_institution_not_assumed_to_be_degree(synthetic_docx_result: ParsedResume):
    # Regression: a single bold label line used to be assumed to always be
    # the *degree* (true for one real fixture's convention) — here the
    # bold line is the *institution* ("University of Texas at Austin"),
    # identified instead by positive institution-keyword content, not by
    # position/convention alone.
    assert len(synthetic_docx_result.education) == 1
    entry = synthetic_docx_result.education[0]
    assert entry.institution == "University of Texas at Austin"
    assert entry.degree == "Bachelor of Science"
    assert entry.field == "Computer Science"
    assert entry.startDate == "2016"
    assert entry.endDate == "2020"


# --- Two-column "sidebar" resume (Abhay Odedra) -------------------------
# A Canva-style template with a narrow left sidebar (contact/projects/
# education/tools/languages/certifications) beside a main right column
# (name/about-me/experience/skills-as-badges) — PyMuPDF's raw block order
# for this file has essentially no relation to visual reading order at
# all, interleaving unrelated sections into nonsense without column-aware
# reordering (`_reorder_multi_column` in segmentation.py). Also exercises
# several other real conventions found only in this fixture: a stylized
# name split across two same-size lines, a "TOOLS" section header outside
# the original alias vocabulary, badge/pill-style skills with no commas,
# a certification name wrapping mid-parenthetical across two lines, and
# project entries with no bold/size distinction at all (name is inline
# prose immediately before a parenthetical + colon).


def test_two_column_name_merged_across_lines(two_column_result: ParsedResume):
    # Regression: a stylized name rendered as two same-max-font-size lines
    # ("ABHAY" / "ODEDRA") used to only capture whichever single line
    # happened to be picked, dropping the other half of the name.
    assert two_column_result.contact.fullName == "ABHAY ODEDRA"


def test_two_column_contact_details_correct(two_column_result: ParsedResume):
    assert two_column_result.contact.email == "abhayodiii19@gmail.com"
    assert two_column_result.contact.phone
    assert "8780894037" in two_column_result.contact.phone.replace(" ", "").replace("+91", "91")
    assert two_column_result.contact.location
    assert "ahmedabad" in two_column_result.contact.location.lower()


def test_two_column_experience_not_split_across_columns(two_column_result: ParsedResume):
    # Regression: without column-aware reordering, the two job entries
    # (both in the right-hand main column) used to get interleaved with
    # unrelated left-sidebar content between them.
    companies = {(e.company or "").lower() for e in two_column_result.experience}
    assert any("ahvi" in c for c in companies)
    assert any("tops" in c for c in companies)
    titles = {(e.title or "").lower() for e in two_column_result.experience}
    assert any("social media manager" in t for t in titles)


def test_two_column_education_not_corrupted_by_unrecognized_tools_header(
    two_column_result: ParsedResume,
):
    # Regression: "TOOLS" wasn't in the skills header alias vocabulary, so
    # its entire content (8 tool names) silently bled into whatever
    # section preceded it (Education), producing a nonsense second
    # "education" entry with the tool list as its institution.
    assert len(two_column_result.education) == 1
    entry = two_column_result.education[0]
    assert entry.institution and "bknmu" in entry.institution.lower()
    assert entry.degree and "bachelor" in entry.degree.lower()


def test_two_column_skills_include_badge_style_and_tools_items(two_column_result: ParsedResume):
    # Regression: pill/badge-style skills (one short phrase per line, no
    # commas at all) used to all get joined into one unsplittable blob and
    # mostly dropped; "TOOLS" section items were lost entirely (see above).
    skill_names = {s.skill.lower() for s in two_column_result.skills}
    for expected in ["canva", "wordpress", "mailchimp", "content creation", "content planning"]:
        assert expected in skill_names, f"missing skill {expected}"


def test_two_column_certification_name_merged_across_wrapped_parenthetical(
    two_column_result: ParsedResume,
):
    # Regression: "Diploma in Digital Marketing (Tops" / "Technologies)"
    # used to become two separate nonsense certification entries instead
    # of one name wrapping mid-parenthetical.
    names = [c.name.lower() for c in two_column_result.certifications]
    assert any("diploma in digital marketing" in n and "technologies" in n for n in names)
    assert any("nsdc" in n for n in names)


def test_two_column_projects_extracted_from_inline_prose_titles(two_column_result: ParsedResume):
    # Regression: these project names have zero formatting distinction
    # from their description (no bold, no size jump, no bullet) — just
    # inline prose immediately before a parenthetical + colon, one of
    # which itself wraps across two PDF lines ("Dame Essentials
    # (Performance" / "Marketing): Created..."). The old formatting-only
    # detection found no title lines at all and returned zero projects.
    names = [p.name.lower() for p in two_column_result.projects]
    assert any("flinkit" in n for n in names)
    assert any("dame essentials" in n and "performance marketing" in n for n in names)
    assert any("jio hotstar" in n for n in names)


def test_unparseable_file_raises():
    from app.pipeline import UnparseableFileError

    with pytest.raises(UnparseableFileError):
        parse_resume(b"this is not a real pdf or docx", SourceFileType.pdf)


def test_empty_file_raises():
    from app.pipeline import UnparseableFileError

    with pytest.raises(UnparseableFileError):
        parse_resume(b"", SourceFileType.pdf)
