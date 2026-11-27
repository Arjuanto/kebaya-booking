"""Pemeriksaan dataset dari tim Data Science sebelum dipakai melatih model.

Langkah 10 pada langkah kerja AI: dataset tidak langsung dipakai. Skrip ini memeriksa
struktur, tanggal, asal data, data pribadi, dan kecocokan dengan aturan yang sudah
disepakati, lalu mencetak laporan.

Jalankan dari folder ml-service:

    python -m src.check_dataset --data ../data/raw/<nama-berkas>.csv

Tingkat temuan:
- GAGAL       : dataset jangan dipakai dulu. Kembalikan ke Data Science.
- PERINGATAN  : boleh dipakai, tetapi perlu dibahas atau dicatat di README.
- INFO        : bahan untuk README dan laporan, tidak perlu tindakan.

Laporan sengaja TIDAK menampilkan isi kolom teks (misalnya catatan), hanya id_booking
baris yang bermasalah, supaya hasilnya aman ditempel di grup atau di issue.

Kode keluar 1 jika ada temuan GAGAL, supaya bisa dipakai di skrip lain.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from src.size_rule import SizeTable

KOLOM_WAJIB = ["tanggal_pemakaian", "asal_data"]
KOLOM_DIHARAPKAN = ["id_booking", "kode_kebaya", "perkiraan_ukuran", "ld_cm", "status_pembayaran"]
ASAL_SAH = {"asli", "contoh"}
STATUS_SAH = {"dp", "lunas"}

# Nama kolom yang menandakan data pribadi. nama_bulan dan nama_hari bukan data pribadi.
POLA_KOLOM_PRIBADI = re.compile(
    r"^(nama|name)$|^nama_(pelanggan|customer|penyewa|lengkap|cust)|telepon|telp|no_?hp|"
    r"^hp$|whatsapp|^wa$|^no_wa|alamat|e-?mail|instagram|^ig$|^nik$",
    re.IGNORECASE,
)
POLA_ISI_PRIBADI = {
    "nomor HP": re.compile(r"(?:\+?62|\b0)8\d{7,11}\b"),
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
    "akun media sosial (@...)": re.compile(r"(?<![\w.])@[A-Za-z0-9_.]{3,}"),
}

# Blok sewa bawaan bila dataset tidak punya kolom blok: H-1 sampai H+3 (5 hari).
BLOK_SEBELUM_HARI = 1
BLOK_SESUDAH_HARI = 3


@dataclass
class Temuan:
    tingkat: str  # GAGAL | PERINGATAN | INFO
    judul: str
    rincian: list[str] = field(default_factory=list)


def _contoh_id(df: pd.DataFrame, mask: pd.Series, n: int = 10) -> str:
    """Daftar id_booking untuk baris bermasalah, tanpa isi kolomnya."""
    if "id_booking" in df.columns:
        ids = df.loc[mask, "id_booking"].astype(str).tolist()
    else:
        ids = [f"baris {i + 2}" for i in df.index[mask]]  # +2: header dan indeks mulai 0
    lebih = f" (+{len(ids) - n} lainnya)" if len(ids) > n else ""
    return ", ".join(ids[:n]) + lebih


def cek_struktur(df: pd.DataFrame, kolom_ukuran: str) -> list[Temuan]:
    hasil = [Temuan("INFO", f"Ukuran dataset: {len(df)} baris, {df.shape[1]} kolom")]
    hilang = [k for k in KOLOM_WAJIB if k not in df.columns]
    if hilang:
        hasil.append(Temuan("GAGAL", "Kolom wajib tidak ada", [", ".join(hilang)]))
    diharapkan = [k if k != "perkiraan_ukuran" else kolom_ukuran for k in KOLOM_DIHARAPKAN]
    kurang = [k for k in diharapkan if k not in df.columns]
    if kurang:
        hasil.append(
            Temuan("PERINGATAN", "Kolom yang biasanya dipakai tidak ada", [", ".join(kurang)])
        )
    return hasil


def cek_tanggal(df: pd.DataFrame) -> list[Temuan]:
    if "tanggal_pemakaian" not in df.columns:
        return []
    tgl = pd.to_datetime(df["tanggal_pemakaian"], errors="coerce")
    hasil = []
    rusak = tgl.isna()
    if rusak.any():
        hasil.append(
            Temuan(
                "GAGAL",
                f"{int(rusak.sum())} tanggal_pemakaian kosong atau tidak terbaca",
                [_contoh_id(df, rusak)],
            )
        )
    rincian = [f"semua : {tgl.min():%Y-%m-%d} s.d. {tgl.max():%Y-%m-%d}"]
    if "asal_data" in df.columns:
        for asal, t in tgl.groupby(df["asal_data"]):
            rincian.append(f"{asal:<6}: {t.min():%Y-%m-%d} s.d. {t.max():%Y-%m-%d}")
    hasil.append(Temuan("INFO", "Rentang tanggal pemakaian", rincian))
    return hasil


def cek_asal_data(df: pd.DataFrame) -> list[Temuan]:
    if "asal_data" not in df.columns:
        return []
    nilai = df["asal_data"].astype(str).str.strip()
    hasil = []
    asing = ~nilai.isin(ASAL_SAH)
    if asing.any():
        hasil.append(
            Temuan(
                "GAGAL",
                "asal_data berisi nilai selain 'asli' dan 'contoh'",
                [f"nilai: {sorted(nilai[asing].unique())}", _contoh_id(df, asing)],
            )
        )
    jumlah = nilai.value_counts()
    if jumlah.get("asli", 0) == 0:
        hasil.append(Temuan("GAGAL", "Tidak ada baris data asli; model tidak bisa dilatih"))
    hasil.append(
        Temuan("INFO", "Jumlah baris per asal_data", [f"{k}: {v}" for k, v in jumlah.items()])
    )
    return hasil


def cek_data_pribadi(df: pd.DataFrame) -> list[Temuan]:
    hasil = []
    kolom_pribadi = [k for k in df.columns if POLA_KOLOM_PRIBADI.search(k)]
    if kolom_pribadi:
        hasil.append(
            Temuan(
                "GAGAL",
                "Ada kolom yang tampaknya data pribadi. Minta Data Science membuangnya",
                [", ".join(kolom_pribadi)],
            )
        )

    for kolom in df.select_dtypes(include=["object", "string"]).columns:
        teks = df[kolom].astype("string").fillna("")
        for jenis, pola in POLA_ISI_PRIBADI.items():
            kena = teks.str.contains(pola, regex=True)
            if kena.any():
                hasil.append(
                    Temuan(
                        "GAGAL",
                        f"Kolom '{kolom}' memuat {jenis} di {int(kena.sum())} baris",
                        [_contoh_id(df, kena)],
                    )
                )

    if "id_customer" in df.columns:
        hasil.append(
            Temuan(
                "INFO",
                "Ada kolom id_customer",
                [
                    f"{df['id_customer'].nunique()} id unik. Aman selama tidak ada tabel yang "
                    "menghubungkannya ke nama, dan dataset tetap tidak di-commit."
                ],
            )
        )
    if not kolom_pribadi and not any(t.tingkat == "GAGAL" for t in hasil):
        hasil.insert(0, Temuan("INFO", "Tidak ditemukan kolom nama, nomor HP, email, atau akun media sosial"))
    return hasil


def cek_status_pembayaran(df: pd.DataFrame) -> list[Temuan]:
    if "status_pembayaran" not in df.columns:
        return []
    nilai = df["status_pembayaran"].astype(str).str.strip().str.lower()
    asing = ~nilai.isin(STATUS_SAH)
    if not asing.any():
        return [Temuan("INFO", "status_pembayaran hanya berisi 'dp' dan 'lunas'")]
    rincian = []
    for v in sorted(nilai[asing].unique()):
        rincian.append(f"'{v}': {_contoh_id(df, nilai == v)}")
    return [Temuan("PERINGATAN", "status_pembayaran berisi nilai di luar 'dp' dan 'lunas'", rincian)]


def cek_duplikat_dan_konstan(df: pd.DataFrame) -> list[Temuan]:
    hasil = []
    if "id_booking" in df.columns:
        dobel = df["id_booking"].duplicated(keep=False)
        if dobel.any():
            hasil.append(Temuan("GAGAL", f"{int(dobel.sum())} baris punya id_booking kembar", [_contoh_id(df, dobel)]))
    sama_persis = df.duplicated(keep="first")
    if sama_persis.any():
        hasil.append(
            Temuan("PERINGATAN", f"{int(sama_persis.sum())} baris sama persis dengan baris lain", [_contoh_id(df, sama_persis)])
        )
    konstan = [k for k in df.columns if df[k].nunique(dropna=False) <= 1]
    if konstan:
        hasil.append(
            Temuan("PERINGATAN", "Kolom bernilai sama di semua baris (tidak membawa informasi)", [", ".join(konstan)])
        )
    return hasil


def cek_catatan(df: pd.DataFrame) -> list[Temuan]:
    """Kolom catatan seharusnya tidak lagi menyalin tujuan acara."""
    if not {"catatan", "tujuan_acara"} <= set(df.columns):
        return []
    catatan = df["catatan"].astype("string").fillna("").str.lower()
    tujuan = df["tujuan_acara"].astype("string").fillna("").str.lower()
    ikut = pd.Series(
        [bool(t) and t in c for c, t in zip(catatan, tujuan)], index=df.index
    )
    if ikut.any():
        return [
            Temuan(
                "PERINGATAN",
                f"Kolom catatan masih memuat tujuan acara di {int(ikut.sum())} baris",
                ["Sesuai kesepakatan, catatan dan tujuan_acara dipisah."],
            )
        ]
    return []


def _blok(df: pd.DataFrame) -> tuple[pd.Series, pd.Series, str]:
    if {"tanggal_mulai_blok", "tanggal_selesai_blok"} <= set(df.columns):
        mulai = pd.to_datetime(df["tanggal_mulai_blok"], errors="coerce")
        selesai = pd.to_datetime(df["tanggal_selesai_blok"], errors="coerce")
        return mulai, selesai, "kolom tanggal_mulai_blok dan tanggal_selesai_blok"
    tgl = pd.to_datetime(df["tanggal_pemakaian"], errors="coerce")
    return (
        tgl - pd.Timedelta(days=BLOK_SEBELUM_HARI),
        tgl + pd.Timedelta(days=BLOK_SESUDAH_HARI),
        f"aturan bawaan H-{BLOK_SEBELUM_HARI} s.d. H+{BLOK_SESUDAH_HARI}",
    )


def cek_bentrok(df: pd.DataFrame) -> list[Temuan]:
    """Hitung ulang bentrok jadwal per kode kebaya, lalu bandingkan dengan indikasi_bentrok."""
    if not {"kode_kebaya", "tanggal_pemakaian"} <= set(df.columns):
        return []
    mulai, selesai, sumber_blok = _blok(df)
    kerja = pd.DataFrame({"kode": df["kode_kebaya"], "mulai": mulai, "selesai": selesai}).dropna()
    kerja = kerja.sort_values(["kode", "mulai"])
    bentrok = pd.Series(False, index=df.index)
    for _, grup in kerja.groupby("kode"):
        batas = pd.Timestamp.min
        idx_sebelumnya = None
        for idx, baris in grup.iterrows():
            if idx_sebelumnya is not None and baris["mulai"] <= batas:
                bentrok[idx] = True
                bentrok[idx_sebelumnya] = True
            if baris["selesai"] > batas:
                batas, idx_sebelumnya = baris["selesai"], idx

    hasil = []
    if "asal_data" in df.columns:
        asli = df["asal_data"] == "asli"
        n_asli = int((bentrok & asli).sum())
        if n_asli:
            hasil.append(
                Temuan(
                    "PERINGATAN",
                    f"{n_asli} baris data asli memakai kode kebaya yang sama dengan blok sewa tumpang tindih",
                    [
                        f"Blok sewa dari {sumber_blok}.",
                        "Kemungkinan satu kode kebaya punya lebih dari satu potong. Tanyakan ke owner.",
                        _contoh_id(df, bentrok & asli),
                    ],
                )
            )
    if "indikasi_bentrok" in df.columns:
        tanda = df["indikasi_bentrok"].fillna(0).astype(int) == 1
        beda = tanda != bentrok
        if beda.any():
            hasil.append(
                Temuan(
                    "PERINGATAN",
                    f"indikasi_bentrok berbeda dari hasil hitung ulang di {int(beda.sum())} baris",
                    [
                        f"Hitung ulang menandai {int(bentrok.sum())} baris, kolom dataset menandai {int(tanda.sum())}.",
                        "Samakan definisinya dengan Data Science: apakah kedua baris yang bentrok ditandai, atau hanya yang lebih akhir?",
                    ],
                )
            )
        else:
            hasil.append(Temuan("INFO", "indikasi_bentrok sama dengan hasil hitung ulang"))
    return hasil


def cek_ukuran(df: pd.DataFrame, kolom_ukuran: str, tabel: SizeTable) -> list[Temuan]:
    if kolom_ukuran not in df.columns:
        return []
    hasil = []
    ukuran_tabel = [r["size"] for r in tabel.ranges]
    nilai = df[kolom_ukuran].astype(str).str.strip()
    asing = ~nilai.isin(ukuran_tabel)
    if asing.any():
        hasil.append(
            Temuan(
                "PERINGATAN",
                f"{kolom_ukuran} berisi ukuran yang tidak ada di config/size_table.json",
                [f"nilai: {sorted(nilai[asing].unique())}", _contoh_id(df, asing)],
            )
        )
    if "ld_cm" not in df.columns:
        return hasil

    rentang = df.groupby(nilai)["ld_cm"].agg(["min", "max", "count"])
    rentang = rentang.reindex([u for u in ukuran_tabel if u in rentang.index] + [u for u in rentang.index if u not in ukuran_tabel])
    tabel_map = {r["size"]: (r["ld_min"], r["ld_max"]) for r in tabel.ranges}
    rincian = [f"{'ukuran':<7}{'LD dataset':>14}{'LD tabel':>14}{'baris':>8}"]
    beda = False
    for ukuran, baris in rentang.iterrows():
        di_tabel = tabel_map.get(ukuran)
        teks_tabel = f"{di_tabel[0]}-{di_tabel[1]}" if di_tabel else "-"
        cocok = di_tabel is not None and di_tabel[0] <= baris["min"] and baris["max"] <= di_tabel[1]
        beda |= not cocok
        tanda = "" if cocok else "  <- beda"
        teks_dataset = f"{baris['min']:.0f}-{baris['max']:.0f}"
        rincian.append(f"{ukuran:<7}{teks_dataset:>14}{teks_tabel:>14}{int(baris['count']):>8}{tanda}")

    urut = rentang.dropna().sort_values("min")
    tumpang = (urut["min"].shift(-1) <= urut["max"]).iloc[:-1]
    if tumpang.any():
        hasil.append(
            Temuan("PERINGATAN", "Rentang lingkar dada antar-ukuran di dataset tumpang tindih", [", ".join(tumpang[tumpang].index)])
        )
    hasil.append(
        Temuan(
            "PERINGATAN" if beda else "INFO",
            f"Rentang LD per ukuran: dataset vs tabel (versi {tabel.version})",
            rincian + (["Perbarui config/size_table.json dan naikkan table_version."] if beda else []),
        )
    )
    return hasil


def cek_mingguan_asli(df: pd.DataFrame) -> list[Temuan]:
    """Ringkasan data asli per minggu (Senin) dan per bulan, bahan README dan diskusi DS."""
    if not {"tanggal_pemakaian", "asal_data"} <= set(df.columns):
        return []
    asli = df[df["asal_data"] == "asli"].copy()
    asli["tgl"] = pd.to_datetime(asli["tanggal_pemakaian"], errors="coerce")
    asli = asli.dropna(subset=["tgl"])
    if asli.empty:
        return []
    mingguan = asli.set_index("tgl").resample("W-MON", label="left", closed="left").size()
    nol = mingguan[mingguan == 0]
    bulanan = asli.groupby(asli["tgl"].dt.to_period("M")).size()
    hasil = [
        Temuan(
            "INFO",
            f"Data asli: {len(mingguan)} minggu, median {mingguan.median():.0f} dan maksimum {mingguan.max()} pemesanan per minggu",
            ["per bulan: " + ", ".join(f"{p}={n}" for p, n in bulanan.items())],
        )
    ]
    if len(nol):
        hasil.append(
            Temuan(
                "PERINGATAN",
                f"{len(nol)} minggu data asli tanpa pemesanan",
                [
                    "Senin awal minggu: " + ", ".join(f"{d:%Y-%m-%d}" for d in nol.index),
                    "Pastikan ke Data Science: memang tidak ada pesanan, atau tidak tercatat?",
                ],
            )
        )
    return hasil


def periksa(df: pd.DataFrame, kolom_ukuran: str = "perkiraan_ukuran", tabel: SizeTable | None = None) -> list[Temuan]:
    tabel = tabel or SizeTable()
    temuan: list[Temuan] = []
    temuan += cek_struktur(df, kolom_ukuran)
    temuan += cek_tanggal(df)
    temuan += cek_asal_data(df)
    temuan += cek_data_pribadi(df)
    temuan += cek_status_pembayaran(df)
    temuan += cek_duplikat_dan_konstan(df)
    temuan += cek_catatan(df)
    temuan += cek_bentrok(df)
    temuan += cek_ukuran(df, kolom_ukuran, tabel)
    temuan += cek_mingguan_asli(df)
    return temuan


def cetak(temuan: list[Temuan], sumber: str) -> None:
    urutan = {"GAGAL": 0, "PERINGATAN": 1, "INFO": 2}
    print(f"Pemeriksaan dataset: {sumber}\n")
    for t in sorted(temuan, key=lambda t: urutan[t.tingkat]):
        print(f"[{t.tingkat}] {t.judul}")
        for r in t.rincian:
            print(f"    {r}")
    n = {k: sum(t.tingkat == k for t in temuan) for k in urutan}
    print(f"\nRingkasan: {n['GAGAL']} GAGAL, {n['PERINGATAN']} PERINGATAN, {n['INFO']} INFO")
    if n["GAGAL"]:
        print("Dataset belum layak dipakai. Kembalikan ke Data Science dengan daftar GAGAL di atas.")
    elif n["PERINGATAN"]:
        print("Dataset boleh dipakai. Bahas PERINGATAN dengan Data Science dan catat yang relevan di README.")
    else:
        print("Dataset siap dipakai.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Periksa dataset sebelum melatih model.")
    parser.add_argument("--data", required=True, help="Path CSV dataset dari tim Data Science")
    parser.add_argument("--kolom-ukuran", default="perkiraan_ukuran", help="Kolom ukuran pada dataset")
    args = parser.parse_args(argv)

    path = Path(args.data)
    if not path.exists():
        print(f"Berkas tidak ditemukan: {path}")
        return 1
    df = pd.read_csv(path)
    temuan = periksa(df, args.kolom_ukuran)
    cetak(temuan, path.name)
    return 1 if any(t.tingkat == "GAGAL" for t in temuan) else 0


if __name__ == "__main__":
    sys.exit(main())
