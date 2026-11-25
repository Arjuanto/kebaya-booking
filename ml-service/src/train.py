"""Melatih dan membandingkan model prediksi permintaan mingguan.

Memenuhi checklist AI nomor 2, 3, dan 6:
- preprocessing berada di dalam Pipeline dan hanya dipelajari dari data latih,
- minimal dua model dibandingkan dengan metrik yang sama,
- hasilnya ditulis sebagai tabel yang bisa disalin ke README.

Pemilihan model dilakukan MANUAL (tanpa AutoML), sesuai larangan jalur AI.

Contoh pemakaian:
    python -m src.train --data data/raw/dataset.csv --cutoff 2026-10-01
    python -m src.train --data data/raw/dataset.csv --cutoff 2026-10-01 --sumber semua
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.preprocessing import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    add_features,
    load_bookings,
    load_event_weeks,
    time_split,
    to_weekly,
)

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "model.joblib"
METRICS_PATH = ROOT / "models" / "metrics.json"


def build_preprocessor() -> ColumnTransformer:
    """Preprocessing yang dipelajari HANYA dari data latih.

    - bulan diperlakukan sebagai kategori (Januari bukan "lebih kecil" dari Desember),
    - sisanya diskalakan agar Ridge tidak timpang antar fitur.
    """
    return ColumnTransformer(
        transformers=[
            ("bulan", OneHotEncoder(handle_unknown="ignore"), ["bulan"]),
            ("numerik", StandardScaler(), ["minggu_ke", "is_event_week"]),
        ]
    )


def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    return {"mae": round(float(mae), 3), "rmse": round(rmse, 3)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Latih dan bandingkan model prediksi permintaan.")
    parser.add_argument("--data", required=True, help="CSV dataset per baris pemesanan")
    parser.add_argument("--cutoff", required=True, help="Tanggal awal data uji, contoh 2026-10-01")
    parser.add_argument(
        "--sumber",
        choices=["asli", "semua"],
        default="asli",
        help="Baris yang dipakai MELATIH. Evaluasi selalu memakai data asli.",
    )
    parser.add_argument(
        "--kolom-ukuran",
        default="perkiraan_ukuran",
        help="Kolom ukuran untuk memecah prediksi bulanan per ukuran (proporsi historis).",
    )
    parser.add_argument("--out", default=str(MODEL_PATH))
    args = parser.parse_args()

    bookings = load_bookings(args.data)
    events = load_event_weeks()

    # Evaluasi selalu pada data asli: angka dari data contoh tidak mewakili usaha UMKM.
    weekly_asli = add_features(to_weekly(bookings, only_origin="asli"), events)
    _, test = time_split(weekly_asli, args.cutoff)

    if args.sumber == "asli":
        train, _ = time_split(weekly_asli, args.cutoff)
        data_source = "asli"
        data_note = "Dilatih dan dievaluasi dari data asli UMKM saja."
        baris_latih = bookings[bookings["asal_data"] == "asli"]
    else:
        weekly_semua = add_features(to_weekly(bookings), events)
        train, _ = time_split(weekly_semua, args.cutoff)
        data_source = "campuran"
        data_note = (
            "Dilatih dari data asli ditambah data contoh berlabel, dievaluasi pada data asli. "
            "Lihat README untuk sumber dan cara pembuatan data contoh."
        )
        baris_latih = bookings
    baris_latih = baris_latih[baris_latih["tanggal_pemakaian"] < pd.Timestamp(args.cutoff)]

    # Proporsi ukuran historis untuk memecah prediksi bulanan per ukuran.
    # Ini BUKAN keluaran model; dihitung dari baris latih saja agar tidak bocor ke data uji.
    if args.kolom_ukuran in baris_latih.columns and not baris_latih.empty:
        size_proportions = {
            str(k): round(float(v), 4)
            for k, v in baris_latih[args.kolom_ukuran].value_counts(normalize=True).items()
        }
    else:
        size_proportions = {}
        print(f"PERHATIAN: kolom '{args.kolom_ukuran}' tidak ada; prediksi tidak dipecah per ukuran.")

    if train.empty or test.empty:
        raise SystemExit("Data latih atau data uji kosong. Periksa nilai --cutoff.")

    X_train, y_train = train[FEATURE_COLUMNS], train[TARGET_COLUMN]
    X_test, y_test = test[FEATURE_COLUMNS], test[TARGET_COLUMN]

    results: dict[str, dict] = {}

    # Baseline: selalu menebak rata-rata data latih. Tanpa pembanding ini,
    # angka MAE model tidak punya arti.
    baseline_pred = np.full(len(y_test), float(y_train.mean()))
    results["baseline_rata_rata"] = evaluate(y_test, baseline_pred)

    candidates = {
        "ridge": Pipeline(
            [("pra", build_preprocessor()), ("model", Ridge(alpha=1.0, random_state=None))]
        ),
        "random_forest": Pipeline(
            [
                ("pra", build_preprocessor()),
                ("model", RandomForestRegressor(n_estimators=300, random_state=42)),
            ]
        ),
    }

    fitted = {}
    for name, pipe in candidates.items():
        pipe.fit(X_train, y_train)  # pipeline belajar hanya dari data latih
        results[name] = evaluate(y_test, pipe.predict(X_test))
        fitted[name] = pipe

    best_name = min(fitted, key=lambda n: results[n]["mae"])
    best = fitted[best_name]

    print(f"\nMinggu latih: {len(train)} | minggu uji: {len(test)} | sumber latih: {args.sumber}\n")
    print("| Model | MAE | RMSE |")
    print("|---|---|---|")
    for name, m in results.items():
        print(f"| {name} | {m['mae']} | {m['rmse']} |")
    print(f"\nModel terbaik menurut MAE: {best_name}")
    if results[best_name]["mae"] >= results["baseline_rata_rata"]["mae"]:
        print(
            "PERHATIAN: model belum mengalahkan baseline. Laporkan apa adanya di README "
            "beserta penjelasan sebabnya; itu temuan yang sah."
        )

    meta = {
        "name": best_name,
        "version": "1.0.0",
        "mae_validasi": results[best_name]["mae"],
        "rmse_validasi": results[best_name]["rmse"],
        "data_note": data_note,
        "data_source": data_source,
        "size_proportions": size_proportions,
        "kolom_ukuran": args.kolom_ukuran,
        "sumber_latih": args.sumber,
        "cutoff": args.cutoff,
        "n_minggu_latih": int(len(train)),
        "n_minggu_uji": int(len(test)),
        "fitur": FEATURE_COLUMNS,
        "dilatih_pada": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Pipeline dan model disimpan sebagai satu artefak supaya preprocessing ikut terbawa.
    joblib.dump({"pipeline": best, "meta": meta}, out_path)
    # Metrik disimpan di samping berkas model, bukan selalu di models/.
    metrics_path = out_path.parent / METRICS_PATH.name
    metrics_path.write_text(
        json.dumps({"perbandingan": results, "meta": meta}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nModel disimpan di {out_path}\nMetrik disimpan di {metrics_path}")


if __name__ == "__main__":
    main()
