"""Skema request dan response, mengikuti docs/api-contract.md v0.3 bagian 5.

Nama field di JSON memakai camelCase sesuai konvensi kontrak (bagian 1). Di kode
Python tetap snake_case; konversinya diurus alias generator Pydantic.

Field bertanda "TAMBAHAN" belum ada di kontrak v0.3. Semuanya opsional dan hanya
menambah, jadi tidak merusak pemanggil yang belum memakainya. Usulannya ada di
review kontrak (B1, B2, A1).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---------- GET /health ----------

class ModelVersions(CamelModel):
    size_estimator: str
    demand: str


class HealthResponse(CamelModel):
    status: str
    models: ModelVersions


# ---------- POST /v1/size-estimate ----------

# Rentang kewajaran input disamakan dengan validasi backend (kontrak bagian 2.2),
# supaya input yang lolos di backend tidak ditolak di sini.
LD_MIN, LD_MAX = 60, 150
TB_MIN, TB_MAX = 130, 200
BB_MIN, BB_MAX = 30, 150


class SizeRequest(CamelModel):
    ld: float = Field(..., ge=LD_MIN, le=LD_MAX, description="Lingkar dada (cm)")
    tb: float = Field(..., ge=TB_MIN, le=TB_MAX, description="Tinggi badan (cm)")
    bb: float = Field(..., ge=BB_MIN, le=BB_MAX, description="Berat badan (kg)")


class SizeResponse(CamelModel):
    size: str | None
    in_range: bool
    message: str
    # TAMBAHAN (review B2): versi tabel ukuran yang dipakai menghitung.
    table_version: str


# ---------- POST /v1/predict/demand ----------

class PredictRequest(CamelModel):
    target_month: str = Field(..., description="Bulan yang diprediksi, format YYYY-MM", examples=["2026-12"])

    @field_validator("target_month")
    @classmethod
    def format_bulan(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m")
        except (TypeError, ValueError):
            raise ValueError("targetMonth harus berformat YYYY-MM, misalnya 2026-12") from None
        if len(v) != 7:
            raise ValueError("targetMonth harus berformat YYYY-MM, misalnya 2026-12")
        return v


class PredictionItem(CamelModel):
    size: str
    predicted_count: float


class ModelInfo(CamelModel):
    name: str
    version: str
    # TAMBAHAN (review B1): rata-rata selisih prediksi mingguan pada data uji.
    mae_validasi: float | None = None


class PredictResponse(CamelModel):
    target_month: str
    model: ModelInfo
    data_source: str = Field(..., description="asli | contoh | campuran")
    predictions: list[PredictionItem]
    # TAMBAHAN (review A1): jumlah total bulan itu dan cara angka per ukuran dihitung.
    total_predicted: float | None = None
    size_breakdown: str | None = None
    note: str | None = None
