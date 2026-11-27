"""Melatih dan membandingkan model prediksi permintaan mingguan.

Memenuhi checklist AI nomor 2, 3, dan 6:
- preprocessing berada di dalam Pipeline dan hanya dipelajari dari data latih,
- minimal dua model dibandingkan dengan metrik yang sama,
- hasilnya ditulis sebagai tabel yang bisa disalin ke README.

Pemilihan model dilakukan MANUAL (tanpa AutoML), sesuai larangan jalur AI.

Evaluasi BERGULIR: untuk setiap minggu uji (data asli, mulai --cutoff), model dilatih
pada semua minggu sebelum minggu itu, lalu memprediksi minggu itu. Dengan data asli
yang hanya sekitar 23 minggu, cara ini memberi lebih banyak titik uji daripada satu kali
pemisahan, dan tidak pernah memakai data masa depan.

Dua pembanding wajib ikut dihitung: rata-rata minggu sebelumnya dan "sama dengan minggu
lalu". Model yang tidak mengalahkan keduanya harus dilaporkan apa adanya di README.

Setelah model terbaik dipilih, konfigurasi yang sama dilatih ulang pada SEMUA minggu
sebelum disimpan, supaya model yang di-deploy juga belajar dari minggu terbaru. Angka
maeValidasi tetap berasal dari evaluasi bergulir. --tanpa-refit menyimpan model yang
hanya dilatih sampai cutoff.

Contoh pemakaian (cutoff 2026-08-10 memberi sekitar 13 minggu uji):
    python -m src.train --data ../data/raw/dataset.csv --cutoff 2026-08-10
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
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
    to_weekly,
)

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "model.joblib"
METRICS_PATH = ROOT / "models" / "metrics.json"

BASELINES = ("baseline_rata_rata", "baseline_minggu_lalu")


def build_preprocessor() -> ColumnTransformer:
    """Preprocessing yang dipelajari HANYA dari data latih.

    - bulan diperlakukan sebagai kategori (Januari bukan "lebih kecil" dari Desember),
    - penanda minggu acara diskalakan agar Ridge tidak timpang antar fitur.
    """
    return ColumnTransformer(
        transformers=[
            ("bulan", OneHotEncoder(handle_unknown="ignore"), ["bulan"]),
            ("numerik", StandardScaler(), ["is_event_week"]),
        ]
    )


def build_candidates() -> dict[str, Pipeline]:
    return {
        "ridge": Pipeline([("pra", build_preprocessor()), ("model", Ridge(alpha=1.0))]),
        "random_forest": Pipeline(
            [
                ("pra", build_preprocessor()),
                ("model", RandomForestRegressor(n_estimators=300, random_state=42)),
            ]
        ),
    }


def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    return {"mae": round(float(mae), 3), "rmse": round(rmse, 3)}


def rolling_evaluation(
    weekly_asli: pd.DataFrame,
    train_pool: pd.DataFrame,
    cutoff: pd.Timestamp,
    candidates: dict[str, Pipeline],
) -> tuple[dict[str, dict], int]:
    """Evaluasi bergulir satu minggu ke depan, selalu dinilai pada data asli."""
    test_weeks = weekly_asli[weekly_asli["week_start"] >= cutoff]
    if test_weeks.empty:
        raise SystemExit("Tidak ada minggu uji setelah --cutoff. Pilih tanggal lebih awal.")

    preds: dict[str, list[float]] = {name: [] for name in (*BASELINES, *candidates)}
    for _, row in test_weeks.iterrows():
        week = row["week_start"]
        hist_asli = weekly_asli[weekly_asli["week_start"] < week]
        pool = train_pool[train_pool["week_start"] < week]
        if hist_asli.empty or pool.empty:
            raise SystemExit("Tidak ada data latih sebelum minggu uji pertama. Pilih --cutoff lebih akhir.")

        # Pembanding memakai riwayat data asli, supaya adil terhadap usaha UMKM.
        preds["baseline_rata_rata"].append(float(hist_asli[TARGET_COLUMN].mean()))
        preds["baseline_minggu_lalu"].append(float(hist_asli[TARGET_COLUMN].iloc[-1]))

        X_query = row[FEATURE_COLUMNS].to_frame().T.astype(pool[FEATURE_COLUMNS].dtypes.to_dict())
        for name, pipe in candidates.items():
            fitted = clone(pipe).fit(pool[FEATURE_COLUMNS], pool[TARGET_COLUMN])
            # Jumlah pemesanan tidak mungkin negatif.
            preds[name].append(max(0.0, float(fitted.predict(X_query)[0])))

    y_true = test_weeks[TARGET_COLUMN].to_numpy()
    results = {name: evaluate(y_true, np.array(p)) for name, p in preds.items()}
    return results, len(test_weeks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Latih dan bandingkan model prediksi permintaan.")
    parser.add_argument("--data", required=True, help="CSV dataset per baris pemesanan")
    parser.add_argument(
        "--cutoff",
        required=True,
        help="Minggu uji pertama untuk evaluasi bergulir, contoh 2026-08-10",
    )
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
    parser.add_argument(
        "--tanpa-refit",
        action="store_true",
        help="Simpan model yang hanya dilatih sampai cutoff (tanpa pelatihan ulang semua data).",
    )
    parser.add_argument("--out", default=str(MODEL_PATH))
    args = parser.parse_args()
    cutoff = pd.Timestamp(args.cutoff)

    bookings = load_bookings(args.data)
    events = load_event_weeks()

    # Evaluasi selalu pada data asli: angka dari data contoh tidak mewakili usaha UMKM.
    weekly_asli = add_features(to_weekly(bookings, only_origin="asli"), events)

    if args.sumber == "asli":
        weekly_full = weekly_asli
        data_source = "asli"
        data_note = "Dilatih dan dievaluasi dari data asli UMKM saja."
        baris_latih = bookings[bookings["asal_data"] == "asli"]
    else:
        weekly_full = add_features(to_weekly(bookings), events)
        data_source = "campuran"
        data_note = (
            "Dilatih dari data asli ditambah data contoh berlabel, dievaluasi pada data asli. "
            "Lihat README untuk sumber dan cara pembuatan data contoh."
        )
        baris_latih = bookings

    # Baris yang dipelajari model final: semua baris, atau sampai cutoff jika --tanpa-refit.
    if args.tanpa_refit:
        baris_final = baris_latih[baris_latih["tanggal_pemakaian"] < cutoff]
    else:
        baris_final = baris_latih

    # Bulan kalender yang benar-benar ada di data asli yang dipelajari model final.
    # Dipakai layanan untuk memberi catatan saat bulan target tidak ada di data asli.
    asli_final = baris_final[baris_final["asal_data"] == "asli"]
    bulan_data_asli = sorted(int(b) for b in asli_final["tanggal_pemakaian"].dt.month.unique())

    # Proporsi ukuran historis untuk memecah prediksi bulanan per ukuran.
    # Ini BUKAN keluaran model dan tidak ikut dievaluasi MAE, jadi aman dihitung dari baris final.
    if args.kolom_ukuran in baris_final.columns and not baris_final.empty:
        size_proportions = {
            str(k): round(float(v), 4)
            for k, v in baris_final[args.kolom_ukuran].value_counts(normalize=True).items()
        }
    else:
        size_proportions = {}
        print(f"PERHATIAN: kolom '{args.kolom_ukuran}' tidak ada; prediksi tidak dipecah per ukuran.")

    candidates = build_candidates()
    results, n_uji = rolling_evaluation(weekly_asli, weekly_full, cutoff, candidates)
    n_latih_awal = int((weekly_full["week_start"] < cutoff).sum())

    best_name = min(candidates, key=lambda n: results[n]["mae"])
    pembanding_terbaik = min(BASELINES, key=lambda n: results[n]["mae"])

    if args.tanpa_refit:
        awal = weekly_full[weekly_full["week_start"] < cutoff]
        final = clone(candidates[best_name]).fit(awal[FEATURE_COLUMNS], awal[TARGET_COLUMN])
        n_minggu_final = len(awal)
    else:
        # Konfigurasi terpilih dilatih ulang dari nol pada semua minggu. Evaluasi sudah
        # selesai, jadi minggu uji boleh ikut dipelajari model yang akan di-deploy.
        final = clone(candidates[best_name]).fit(
            weekly_full[FEATURE_COLUMNS], weekly_full[TARGET_COLUMN]
        )
        n_minggu_final = len(weekly_full)

    print(
        f"\nEvaluasi bergulir: {n_uji} minggu uji, latih awal {n_latih_awal} minggu, "
        f"sumber latih: {args.sumber}\n"
    )
    print("| Model | MAE | RMSE |")
    print("|---|---|---|")
    for name, m in results.items():
        print(f"| {name} | {m['mae']} | {m['rmse']} |")
    print(f"\nModel terbaik menurut MAE: {best_name}")
    if args.tanpa_refit:
        print(f"Model disimpan TANPA pelatihan ulang ({n_minggu_final} minggu sampai cutoff).")
    else:
        print(f"Model final dilatih ulang pada semua {n_minggu_final} minggu.")
    if results[best_name]["mae"] >= results[pembanding_terbaik]["mae"]:
        print(
            f"PERHATIAN: model belum mengalahkan {pembanding_terbaik}. Laporkan apa adanya "
            "di README beserta penjelasan sebabnya; itu temuan yang sah."
        )

    meta = {
        "name": best_name,
        "version": "1.0.0",
        "mae_validasi": results[best_name]["mae"],
        "rmse_validasi": results[best_name]["rmse"],
        "metode_evaluasi": "bergulir: latih semua minggu sebelumnya, prediksi 1 minggu berikutnya",
        "data_note": data_note,
        "data_source": data_source,
        "size_proportions": size_proportions,
        "kolom_ukuran": args.kolom_ukuran,
        "sumber_latih": args.sumber,
        "cutoff": args.cutoff,
        "n_minggu_latih_awal": n_latih_awal,
        "n_minggu_uji": int(n_uji),
        "refit_semua_data": not args.tanpa_refit,
        "n_minggu_final": int(n_minggu_final),
        "bulan_data_asli": bulan_data_asli,
        "fitur": FEATURE_COLUMNS,
        "dilatih_pada": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Pipeline dan model disimpan sebagai satu artefak supaya preprocessing ikut terbawa.
    joblib.dump({"pipeline": final, "meta": meta}, out_path)
    # Metrik disimpan di samping berkas model, bukan selalu di models/.
    metrics_path = out_path.parent / METRICS_PATH.name
    metrics_path.write_text(
        json.dumps({"perbandingan": results, "meta": meta}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nModel disimpan di {out_path}\nMetrik disimpan di {metrics_path}")


if __name__ == "__main__":
    main()
