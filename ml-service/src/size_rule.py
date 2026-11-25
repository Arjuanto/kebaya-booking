"""Perkiraan ukuran dari lingkar dada.

PENTING: ini aturan berbasis tabel, BUKAN model yang dilatih. Tulis begitu di README
supaya tidak terbaca sebagai klaim AI. Tabelnya disimpan di config/size_table.json
agar bisa diganti tanpa menyentuh kode begitu owner memberikan tabel resminya.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "size_table.json"


@dataclass
class SizeEstimate:
    size: str | None
    in_range: bool
    message: str
    table_version: str

    def to_dict(self) -> dict:
        return {
            "size": self.size,
            "in_range": self.in_range,
            "message": self.message,
            "table_version": self.table_version,
        }


class SizeTable:
    """Pencarian ukuran berdasarkan rentang lingkar dada."""

    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path else CONFIG_PATH
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.version: str = data.get("table_version", "tidak-diketahui")
        self.sumber: str = data.get("sumber", "")
        self.ranges: list[dict] = sorted(data["ranges"], key=lambda r: r["ld_min"])

    def estimate(self, ld_cm: float, tb_cm: float | None = None, bb_kg: float | None = None) -> SizeEstimate:
        """Kembalikan ukuran untuk lingkar dada tertentu.

        tb_cm dan bb_kg diterima dan divalidasi di lapisan API, tetapi belum dipakai
        pada tabel versi ini. Keduanya tetap ada di kontrak supaya bentuk request tidak
        berubah ketika tabel resmi owner nanti memakainya.
        """
        for row in self.ranges:
            if row["ld_min"] <= ld_cm <= row["ld_max"]:
                ukuran = row["size"]
                return SizeEstimate(
                    ukuran, True, f"Perkiraan ukuran {ukuran} berdasarkan tabel ukuran", self.version
                )

        return SizeEstimate(
            None,
            False,
            "Ukuran di luar tabel, silakan hubungi admin untuk fitting",
            self.version,
        )

    @property
    def sizes(self) -> list[str]:
        """Daftar ukuran sesuai urutan tabel (dari terkecil)."""
        return [r["size"] for r in self.ranges]
