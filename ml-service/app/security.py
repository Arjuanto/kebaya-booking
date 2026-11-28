"""Pemeriksaan kunci antar layanan.

Backend mengirim header X-API-Key. Nilainya disimpan di variabel lingkungan pada
kedua layanan, tidak pernah ditulis di kode maupun repositori.

Jika API_KEY belum diisi, semua permintaan berkunci DITOLAK (bukan dilewati). Dengan
begitu, lupa mengisi variabel di Render membuat layanan tertutup, bukan terbuka untuk
siapa saja yang tahu URL-nya. Untuk pengembangan lokal, isi API_KEY di berkas .env
(salin dari .env.example).
"""

from __future__ import annotations

import logging
import os
import secrets

from fastapi import Header

from app.errors import ApiError

log = logging.getLogger("ml-service")


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("API_KEY")
    if not expected:
        # Pemanggil tetap menerima 401 biasa; penyebabnya hanya dicatat di log server.
        log.error("API_KEY belum diisi di variabel lingkungan; permintaan berkunci ditolak.")
        raise ApiError(401, "UNAUTHORIZED", "X-API-Key hilang atau salah.")
    # compare_digest: lama perbandingan tidak bergantung pada berapa karakter yang cocok.
    if x_api_key is None or not secrets.compare_digest(x_api_key, expected):
        raise ApiError(401, "UNAUTHORIZED", "X-API-Key hilang atau salah.")
