"""Layanan model (FastAPI) untuk Capstone A26-CS010.

Mengikuti docs/api-contract.md v0.4 bagian 5. Dipanggil HANYA oleh backend Express,
dilindungi header X-API-Key.

    GET  /v1/health             cek layanan hidup (tanpa kunci)
    POST /v1/size-estimate      perkiraan ukuran dari tabel ukuran (aturan, bukan model)
    POST /v1/predict/demand     prediksi jumlah pemesanan untuk satu bulan

Di luar tanggung jawab layanan ini: pemeriksaan ketersediaan kebaya, pencatatan DP,
dan pemanggilan API AI generatif. Semuanya ada di backend.

Menjalankan secara lokal (dari folder ml-service):
    uvicorn app.main:app --reload
Dokumentasi otomatis: http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import Depends, FastAPI

from app.errors import ApiError, register_error_handlers
from app.schemas import (
    HealthResponse,
    ModelInfo,
    ModelVersions,
    PredictionItem,
    PredictRequest,
    PredictResponse,
    SizeRequest,
    SizeResponse,
)
from app.security import verify_api_key
from src.preprocessing import features_for_weeks, load_event_weeks, mondays_in_month
from src.size_rule import SizeTable

try:  # .env hanya untuk pengembangan lokal; di Render variabel diisi lewat dashboard.
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:  # pragma: no cover
    pass

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.getenv("MODEL_PATH", ROOT / "models" / "model.joblib"))
if not MODEL_PATH.is_absolute():
    MODEL_PATH = ROOT / MODEL_PATH
ALLOW_STUB = os.getenv("ALLOW_STUB", "true").lower() == "true"

STUB_NOTE = (
    "JAWABAN TIRUAN. Model belum dipasang; angka ini hanya untuk menyambung integrasi "
    "dan tidak boleh ditampilkan saat demonstrasi."
)
# Angka tiruan per ukuran, hanya dipakai selama model belum ada.
STUB_COUNTS = {"S": 3.0, "M": 8.0, "L": 6.0, "XL": 2.0}

NOTE_BULAN_TANPA_DATA_ASLI = (
    "Bulan ini tidak ada di data asli UMKM, jadi angkanya bersandar pada pola bulan lain "
    "atau data contoh. Anggap sebagai gambaran kasar, bukan perkiraan yang bisa diandalkan."
)

state: dict = {"pipeline": None, "meta": None, "size_table": None, "event_weeks": set()}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Model dimuat sekali saat layanan menyala, bukan setiap permintaan.
    if MODEL_PATH.exists():
        bundle = joblib.load(MODEL_PATH)
        state["pipeline"] = bundle["pipeline"]
        state["meta"] = bundle["meta"]
    state["size_table"] = SizeTable()
    state["event_weeks"] = load_event_weeks()
    yield
    state.clear()


app = FastAPI(
    title="Layanan Model - Sewa Kebaya By Ariegunarti",
    description=(
        "Prediksi permintaan dan perkiraan ukuran. Capstone Asah 2026, tim A26-CS010. "
        "Kontrak: docs/api-contract.md bagian 5."
    ),
    version="1.0.0",
    lifespan=lifespan,
)
register_error_handlers(app)


@app.get("/v1/health", response_model=HealthResponse, tags=["umum"])
# Alias tanpa versi, disembunyikan dari dokumentasi. Hanya supaya pengaturan health check
# Render yang lama (/health) tidak gagal; pemanggil baru memakai /v1/health.
@app.get("/health", response_model=HealthResponse, include_in_schema=False)
async def health() -> HealthResponse:
    """Cek layanan hidup. Backend memanggilnya saat menyala dan tiap 10 menit (kontrak v0.4 bagian 5)."""
    meta = state.get("meta") or {}
    table: SizeTable | None = state.get("size_table")
    if state.get("pipeline") is not None:
        demand = meta.get("version", "1.0.0")
    else:
        demand = "stub" if ALLOW_STUB else "belum-ada-model"
    return HealthResponse(
        status="ok",
        models=ModelVersions(
            size_estimator=table.version if table else "belum-dimuat",
            demand=demand,
        ),
    )


@app.post(
    "/v1/size-estimate",
    response_model=SizeResponse,
    tags=["aturan"],
    dependencies=[Depends(verify_api_key)],
)
async def size_estimate(req: SizeRequest) -> SizeResponse:
    """Perkiraan ukuran dari tabel ukuran. Aturan tabel, bukan model terlatih.

    Di luar tabel bukan error: tetap 200 dengan inRange false.
    """
    table: SizeTable = state["size_table"]
    hasil = table.estimate(req.ld, req.tb, req.bb)
    return SizeResponse(**hasil.to_dict())


@app.post(
    "/v1/predict/demand",
    response_model=PredictResponse,
    tags=["model"],
    dependencies=[Depends(verify_api_key)],
)
async def predict_demand(req: PredictRequest) -> PredictResponse:
    """Prediksi jumlah pemesanan untuk satu bulan.

    Model dilatih per minggu; angka bulanan adalah jumlah prediksi mingguan pada bulan
    itu. Angka per ukuran BUKAN keluaran model, melainkan total yang dipecah memakai
    proporsi ukuran historis (lihat field sizeBreakdown).
    """
    pipeline = state.get("pipeline")

    if pipeline is None:
        if not ALLOW_STUB:
            raise ApiError(503, "MODEL_UNAVAILABLE", "Model belum termuat atau layanan belum siap")
        return PredictResponse(
            target_month=req.target_month,
            model=ModelInfo(name="stub", version="0.0.0", mae_validasi=None),
            data_source="contoh",
            predictions=[PredictionItem(size=s, predicted_count=c) for s, c in STUB_COUNTS.items()],
            total_predicted=sum(STUB_COUNTS.values()),
            size_breakdown="tiruan",
            note=STUB_NOTE,
        )

    meta = state.get("meta") or {}
    weeks = mondays_in_month(req.target_month)
    X = features_for_weeks(weeks, state.get("event_weeks"))
    # Jumlah pemesanan tidak mungkin negatif.
    total = float(sum(max(0.0, float(p)) for p in pipeline.predict(X)))

    proporsi: dict[str, float] = meta.get("size_proportions") or {}
    table: SizeTable = state["size_table"]
    urutan = [s for s in table.sizes if s in proporsi] + [s for s in proporsi if s not in table.sizes]

    if proporsi:
        # Pembulatan untuk tampilan dilakukan backend; di sini cukup 1 desimal.
        predictions = [
            PredictionItem(size=s, predicted_count=round(total * proporsi[s], 1)) for s in urutan
        ]
        breakdown = "proporsi_historis"
    else:
        predictions = [PredictionItem(size="TOTAL", predicted_count=round(total, 1))]
        breakdown = "tidak_tersedia"

    # Kontrak v0.4: note hanya diisi bila ada hal yang perlu diketahui admin, selain itu null.
    note = None
    bulan_asli = meta.get("bulan_data_asli")
    if bulan_asli is not None and int(req.target_month[5:7]) not in bulan_asli:
        note = NOTE_BULAN_TANPA_DATA_ASLI

    return PredictResponse(
        target_month=req.target_month,
        model=ModelInfo(
            name=meta.get("name", "tidak-diketahui"),
            version=meta.get("version", "1.0.0"),
            mae_validasi=meta.get("mae_validasi"),
        ),
        data_source=meta.get("data_source", "campuran"),
        predictions=predictions,
        total_predicted=round(total, 1),
        size_breakdown=breakdown,
        note=note,
    )
