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

from .pipeline import UnparseableFileError, parse_resume
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
        logger.warning("Failed to parse upload %r: %s", filename, exc)
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(error=ErrorDetail(message=str(exc))).model_dump(),
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
