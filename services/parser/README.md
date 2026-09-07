# services/parser

Stateless resume-parsing microservice (`Python 3.11 + FastAPI`). Takes a PDF/DOCX
resume upload and returns `ParsedResume` JSON matching
`packages/shared-types/src/parsedResume.ts` exactly (camelCase field names
included). Called synchronously by `apps/api` — see
`docs/architecture.md` ("Parser service contract" / "Parsing pipeline
design") for the full contract this implements.

Not exposed to the internet in production; internal service only.

## Pipeline (non-LLM, hybrid, layout-aware)

1. **Extract with layout metadata** — `app/extraction/pdf_extractor.py` uses
   PyMuPDF (`fitz`) to pull text spans with font size, bold flag, page, and
   position. `app/extraction/docx_extractor.py` uses `python-docx`, and
   synthesizes an equivalent "font size" signal from paragraph style
   (Heading 1/2/3) and run-level bold.
2. **Section segmentation** (`app/segmentation.py`) — classifies each line as
   a header via fuzzy keyword matching (Summary, Skills, Experience,
   Education, Certifications, Projects, Declaration + common synonyms) or a
   font-size/bold jump above the body baseline. Also strips lines that
   repeat on most/all pages (template banners/footers) without accidentally
   stripping the candidate's own name (which legitimately repeats once as
   the page-1 heading and again in a Declaration/signature block).
3. **Per-section extractors** (`app/extractors/`):
   - `contact.py` — name (largest-font line before the first header,
     cross-checked with spaCy `PERSON` NER), email (regex), phone
     (`phonenumbers`), location (spaCy `GPE`/`LOC` NER). Only ever reads the
     top-of-page-1 block *before* the first detected section header, so
     template/agency contact artifacts elsewhere in the document are never
     picked up as the candidate's own details.
   - `skills.py` — spaCy `PhraseMatcher` (case-insensitive) over a curated
     taxonomy (`app/data/skills_taxonomy.json`, ~10 categories, several
     hundred real-world tech/business skills). This is architecturally the
     same technique the third-party `skillNer` package uses internally
     (phrase-matching against a taxonomy), reimplemented against our own
     taxonomy so the project isn't pinned to `skillNer`'s old spaCy version.
     Falls back to matching the whole document if the Skills section yields
     nothing.
   - `experience.py`, `projects.py`, `education.py`, `certifications.py` —
     split section bodies into entries using date-range regexes and
     bold/font-size "new entry" heuristics, per `docs/architecture.md`.
4. `app/pipeline.py` assembles everything into `ParsedResume` and records
   soft failures in `meta.warnings` (e.g. `"no email detected"`) — the
   output is always returned successfully; the calling system treats it as
   a human-editable starting point, not final truth.

### Design trade-off: `en_core_web_sm`

We deliberately use spaCy's **small** English model rather than a larger
one. It's used only for `PERSON`/`GPE`/`LOC` named-entity recognition (name
and location cross-checks) — not for anything that needs deep semantic
understanding — so the small model is enough, and it keeps the install
lightweight (~15MB vs. hundreds of MB for `en_core_web_lg`/trf variants).
The trade-off: the small model occasionally misses unfamiliar names or
mistags a job title as a person, which is why `contact.py` treats NER as a
*cross-check* on top of the primary "largest font on the page" signal,
never a blind override.

## Setup (Windows)

```powershell
cd services\parser
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # if PowerShell blocks script execution:
                                      #   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

(If using `cmd.exe` instead of PowerShell, activate with
`.venv\Scripts\activate.bat`. If using Git Bash, use
`source .venv/Scripts/activate`.)

## Run

```powershell
# from services/parser, with the venv activated
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Or, honoring `PARSER_SERVICE_PORT` (defaults to `8001`):

```powershell
python -m app.main
```

## Test

```powershell
pytest tests/ -v
```

`tests/test_pipeline.py` runs the real pipeline against the two fixture
resumes in `samples/fixtures/` (no mocks) and asserts on realistic,
non-brittle facts about their actual content (verified by inspecting the
raw PDF text while building the extractors — not guessed ground truth).

## API

| Method & path | Body | Response |
|---|---|---|
| `POST /parse` | multipart `file` (`.pdf` or `.docx`) | 200 `ParsedResume` JSON, or 422 `{"error": {"message": "..."}}` |
| `GET /health` | — | 200 `{"status": "ok"}` |

Example:

```bash
curl -X POST http://localhost:8001/parse -F "file=@resume.pdf"
```

A saved example output is at `samples/parsed-resume-example.json` (parsed
from `samples/fixtures/python-developer-resume.pdf`).

## Known limitations

- Contact extraction (email/phone/location) only reads the top-of-page-1
  block before the first section header, by design (see
  `docs/architecture.md`) — a resume that puts contact details somewhere
  else (e.g. a sidebar, or after the summary) won't be picked up there;
  `meta.warnings` will flag it instead of guessing.
- Section/entry splitting relies on font-weight/size and bullet-marker
  conventions that hold for the vast majority of real resumes but aren't
  guaranteed — a resume with no bold/size distinction between a company
  name and a bullet point will parse less precisely. This is expected to
  need human review/editing downstream, which is the intended UX (see
  `parsed_resumes` audit table + editable `candidates` fields in
  `docs/database-schema.md`).
- `en_core_web_sm` NER is a lightweight model and can miss unfamiliar names
  or mistag short phrases; see "Design trade-off" above for how `contact.py`
  compensates.
