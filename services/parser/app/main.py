"""FastAPI entrypoint for the resume-parsing microservice.

Stateless: takes a PDF/DOCX file, returns `ParsedResume` JSON. Called
synchronously by `apps/api` (see `docs/architecture.md` -> "Parser service
contract"). Not exposed to the internet in production.
"""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

from .pipeline import NotAResumeError, UnparseableFileError, parse_resume
from .schemas import ErrorDetail, ErrorResponse, ParsedResume, SourceFileType

logger = logging.getLogger("parser")

app = FastAPI(title="White Label Resume Parser", version="0.1.0")

_EXT_TO_TYPE = {
    "pdf": SourceFileType.pdf,
    "docx": SourceFileType.docx,
}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/parse", response_model=ParsedResume, responses={422: {"model": ErrorResponse}})
async def parse(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    source_file_type = _EXT_TO_TYPE.get(ext)

    if source_file_type is None:
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error=ErrorDetail(message=f"Unsupported file type: {ext or 'unknown'}. Expected .pdf or .docx.")
            ).model_dump(),
        )

    file_bytes = await file.read()

    try:
        result = parse_resume(file_bytes, source_file_type)
    except UnparseableFileError as exc:
        # `exc.__cause__` still carries the original library exception (see
        # the `from exc` in pipeline.py) even though the message shown to
        # the user has been simplified — log both.
        logger.warning("Failed to parse upload %r: %s (cause: %r)", filename, exc, exc.__cause__)
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(error=ErrorDetail(message=str(exc), code="UNPARSEABLE_FILE")).model_dump(),
        )
    except NotAResumeError as exc:
        # Same 422 response shape as UnparseableFileError, but with its own
        # `code` so callers (apps/api, then the upload UI) can reliably
        # branch on "not a resume" without pattern-matching message text.
        # The detailed per-signal reasons go to the log only — they're
        # useful for debugging a wrongly-rejected upload but too technical
        # for the response body.
        logger.info("Rejected non-resume upload %r: %s (%s)", filename, exc, "; ".join(exc.reasons))
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(error=ErrorDetail(message=str(exc), code="NOT_A_RESUME")).model_dump(),
        )
    except Exception as exc:  # noqa: BLE001 - never let an unexpected error 500 an upload silently
        logger.exception("Unexpected error parsing upload %r", filename)
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(error=ErrorDetail(message=f"Failed to parse file: {exc}")).model_dump(),
        )

    return JSONResponse(status_code=200, content=result.model_dump())


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PARSER_SERVICE_PORT", "8001"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
