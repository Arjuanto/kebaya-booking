"""Preprocessing jalur AI.

Batas tanggung jawab:
- Tim Data Science: membersihkan data (membuang nama, merapikan status pembayaran,
  menyeragamkan format tanggal dan kode kebaya).
- Jalur AI (berkas ini): mengubah data bersih per baris pemesanan menjadi tabel
  mingguan berisi fitur dan target yang siap dipelajari model.

Catatan keputusan yang perlu ditulis ulang di README:
- Minggu dimulai hari Senin, sama dengan aturan `week_start` pada kontrak API.
- Minggu tanpa pemesanan diisi 0, karena memang nol, bukan data hilang.
- "Jumlah hari akhir pekan" TIDAK dipakai sebagai fitur: setiap minggu penuh selalu
  punya 2 hari akhir pekan, jadi nilainya sama untuk semua baris dan tidak membawa
  informasi apa pun.
- Minggu dengan lonjakan besar TIDAK dibuang. Itu pola asli hari acara, dan membuang
  data tanpa alasan yang bisa dipertanggungjawabkan dilarang oleh aturan Asah.
- "Minggu ke-" (nomor minggu dalam setahun) TIDAK dipakai sebagai fitur. Data asli hanya
  sampai minggu ke-45 dan lonjakan terbesar ada di ujungnya, sehingga model membaca
  minggu-minggu sesudahnya sebagai kelanjutan lonjakan. Saat diuji, prediksi Desember 2026
  melambung ke sekitar 200 pemesanan pada Ridge maupun Random Forest, kira-kira dua kali
  bulan tersibuk di data asli. Lihat notebooks/eksplorasi_permintaan.ipynb.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"

#: Kolom fitur yang dipakai model. Dipakai juga saat melayani permintaan prediksi.
FEATURE_COLUMNS = ["bulan", "is_event_week"]
TARGET_COLUMN = "n_bookings"


def load_bookings(csv_path: str | Path) -> pd.DataFrame:
    """Baca dataset per baris pemesanan dari tim Data Science."""
    df = pd.read_csv(csv_path)
    if "tanggal_pemakaian" not in df.columns:
        raise ValueError("Kolom 'tanggal_pemakaian' tidak ditemukan pada dataset.")
    df["tanggal_pemakaian"] = pd.to_datetime(df["tanggal_pemakaian"])
    return df


def load_event_weeks(path: str | Path | None = None) -> set[pd.Timestamp]:
    """Daftar minggu acara (Senin awal minggu) dari berkas konfigurasi.

    Kalender disimpan di sisi layanan model, bukan dikirim backend, sesuai
    usulan poin 8 pada kontrak API.
    """
    p = Path(path) if path else CONFIG_DIR / "event_weeks.json"
    if not p.exists():
        return set()
    data = json.loads(p.read_text(encoding="utf-8"))
    return {pd.Timestamp(w).normalize() for w in data.get("event_weeks", [])}


def to_weekly(
    df: pd.DataFrame,
    only_origin: str | None = None,
    origin_col: str = "asal_data",
) -> pd.DataFrame:
    """Agregasi baris pemesanan menjadi jumlah pemesanan per minggu.

    only_origin: isi "asli" untuk menghitung data asli saja, None untuk semua baris.
    """
    data = df
    if only_origin is not None:
        if origin_col not in data.columns:
            raise ValueError(
                f"Kolom '{origin_col}' tidak ada, jadi data asli dan contoh tidak bisa dipisah."
            )
        data = data[data[origin_col] == only_origin]

    if data.empty:
        return pd.DataFrame(columns=["week_start", TARGET_COLUMN])

    counts = (
        data.set_index("tanggal_pemakaian")
        .resample("W-MON", label="left", closed="left")
        .size()  # minggu tanpa pemesanan otomatis bernilai 0
    )

    return (
        counts.rename(TARGET_COLUMN)
        .rename_axis("week_start")
        .reset_index()
    )


def add_features(
    weekly: pd.DataFrame,
    event_weeks: set[pd.Timestamp] | None = None,
) -> pd.DataFrame:
    """Tambahkan fitur kalender ke tabel mingguan."""
    out = weekly.copy()
    weeks = pd.to_datetime(out["week_start"])
    out["bulan"] = weeks.dt.month
    events = event_weeks or set()
    out["is_event_week"] = weeks.dt.normalize().isin(events).astype(int)
    return out


def features_for_weeks(
    week_starts: list[pd.Timestamp],
    event_weeks: set[pd.Timestamp] | None = None,
) -> pd.DataFrame:
    """Bangun fitur untuk minggu yang akan diprediksi (tanpa target)."""
    frame = pd.DataFrame({"week_start": pd.to_datetime(pd.Series(week_starts))})
    return add_features(frame, event_weeks)[FEATURE_COLUMNS]


def mondays_in_month(target_month: str) -> list[pd.Timestamp]:
    """Senin awal setiap minggu yang jatuh di bulan `target_month` (format YYYY-MM).

    Kontrak API meminta prediksi per bulan, sedangkan model dilatih per minggu karena
    data asli terlalu sedikit untuk dilatih per bulan. Prediksi bulanan = jumlah
    prediksi mingguan untuk minggu-minggu yang Seninnya jatuh di bulan itu (4 atau 5 minggu).
    """
    start = pd.Timestamp(f"{target_month}-01")
    end = start + pd.offsets.MonthEnd(0)
    return list(pd.date_range(start, end, freq="W-MON"))


def time_split(df: pd.DataFrame, cutoff: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Pisahkan berdasarkan waktu, bukan acak.

    Minggu sebelum `cutoff` menjadi data latih, sisanya data uji. Pemisahan acak
    akan membocorkan masa depan ke masa lalu pada data berurutan seperti ini.
    """
    cut = pd.Timestamp(cutoff)
    weeks = pd.to_datetime(df["week_start"])
    return df[weeks < cut].copy(), df[weeks >= cut].copy()


def build_weekly_dataset(
    csv_path: str | Path,
    only_origin: str | None = None,
    event_weeks_path: str | Path | None = None,
) -> pd.DataFrame:
    """Jalur lengkap: baca CSV, agregasi mingguan, tambahkan fitur."""
    bookings = load_bookings(csv_path)
    weekly = to_weekly(bookings, only_origin=only_origin)
    return add_features(weekly, load_event_weeks(event_weeks_path))
