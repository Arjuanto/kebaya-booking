"""Satu bentuk error untuk semua endpoint, mengikuti docs/api-contract.md v0.4 bagian 1.2.

    {
      "status": "fail",              # 4xx = "fail", 5xx = "error"
      "code": "VALIDATION_ERROR",
      "message": "Data yang dikirim tidak valid",
      "errors": [ { "field": "ld", "message": "Lingkar dada harus angka antara 60 dan 150" } ]
    }

`errors` hanya ada untuk VALIDATION_ERROR. Handler 422 bawaan FastAPI di-override
menjadi 400 agar seragam dengan backend.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas import BB_MAX, BB_MIN, LD_MAX, LD_MIN, TB_MAX, TB_MIN

log = logging.getLogger("ml-service")

LABEL_FIELD = {
    "ld": ("Lingkar dada", LD_MIN, LD_MAX),
    "tb": ("Tinggi badan", TB_MIN, TB_MAX),
    "bb": ("Berat badan", BB_MIN, BB_MAX),
}


class ApiError(Exception):
    """Error yang sengaja dilempar oleh kode kita sendiri."""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def _status(http_code: int) -> str:
    return "error" if http_code >= 500 else "fail"


def _payload(http_code: int, code: str, message: str, errors: list[dict] | None = None) -> dict:
    body = {"status": _status(http_code), "code": code, "message": message}
    if errors is not None:
        body["errors"] = errors
    return body


def _pesan_validasi(field: str, err: dict) -> str:
    """Terjemahkan pesan Pydantic ke bahasa Indonesia untuk field yang kita kenal."""
    tipe = err.get("type", "")
    if tipe == "missing":
        return f"{field} wajib diisi"
    if field in LABEL_FIELD:
        label, lo, hi = LABEL_FIELD[field]
        return f"{label} harus angka antara {lo} dan {hi}"
    if tipe == "value_error":
        # Pesan dari validator kita sendiri, buang awalan "Value error, ".
        return str(err.get("msg", "")).removeprefix("Value error, ")
    return str(err.get("msg", "tidak valid"))


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status_code, content=_payload(exc.status_code, exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        errors = []
        for err in exc.errors():
            lokasi = [str(p) for p in err.get("loc", []) if p not in ("body", "query")]
            field = ".".join(lokasi) or "body"
            errors.append({"field": field, "message": _pesan_validasi(field, err)})
        return JSONResponse(
            status_code=400,
            content=_payload(400, "VALIDATION_ERROR", "Data yang dikirim tidak valid", errors),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        kode = {401: "UNAUTHORIZED", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(
            exc.status_code, "HTTP_ERROR"
        )
        pesan = {404: "Endpoint tidak ditemukan", 405: "Metode tidak didukung"}.get(
            exc.status_code, str(exc.detail)
        )
        return JSONResponse(status_code=exc.status_code, content=_payload(exc.status_code, kode, pesan))

    @app.exception_handler(Exception)
    async def _internal_error(_: Request, exc: Exception):
        # Detail kesalahan tidak dibocorkan ke pemanggil; cukup dicatat di log server.
        log.exception("Kesalahan tak terduga", exc_info=exc)
        return JSONResponse(
            status_code=500, content=_payload(500, "INTERNAL_ERROR", "Terjadi kesalahan tak terduga")
        )
