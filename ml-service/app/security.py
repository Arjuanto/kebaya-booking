"""Pemeriksaan kunci antar layanan.

Backend mengirim header X-API-Key. Nilainya disimpan di variabel lingkungan pada
kedua layanan, tidak pernah ditulis di kode maupun repositori.
"""

from __future__ import annotations

import os

from fastapi import Header

from app.errors import ApiError


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("API_KEY")
    if not expected:
        # Mode pengembangan lokal: kunci belum dipasang, pemeriksaan dilewati.
        # Di Render, API_KEY WAJIB diisi.
        return
    if x_api_key != expected:
        raise ApiError(401, "UNAUTHORIZED", "X-API-Key hilang atau salah.")
