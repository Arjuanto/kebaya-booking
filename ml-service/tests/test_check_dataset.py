"""Uji pemeriksa dataset (src/check_dataset.py) dengan data kecil buatan sendiri."""

import pandas as pd

from src.check_dataset import main, periksa


def dataset_bersih() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "id_booking": ["B1", "B2", "B3", "B4"],
            "tanggal_pemakaian": ["2026-06-01", "2026-06-09", "2026-06-20", "2026-07-01"],
            "kode_kebaya": ["K1", "K1", "K2", "K3"],
            "ld_cm": [85, 90, 96, 92],
            "perkiraan_ukuran": ["S", "M", "L", "M"],
            "status_pembayaran": ["dp", "lunas", "dp", "lunas"],
            "tujuan_acara": ["Wisuda", "Lamaran", "Wisuda", "Wisuda"],
            "catatan": ["minta fitting", "", "tanpa fitting", ""],
            "asal_data": ["asli", "asli", "asli", "contoh"],
        }
    )


def tingkat(temuan, judul_mengandung: str) -> list[str]:
    return [t.tingkat for t in temuan if judul_mengandung in t.judul]


def test_dataset_bersih_tanpa_gagal_dan_peringatan():
    temuan = periksa(dataset_bersih())
    assert [t for t in temuan if t.tingkat in {"GAGAL", "PERINGATAN"}] == []


def test_tanpa_asal_data_gagal():
    temuan = periksa(dataset_bersih().drop(columns="asal_data"))
    assert "GAGAL" in tingkat(temuan, "Kolom wajib")


def test_asal_data_tidak_sah_gagal():
    df = dataset_bersih()
    df.loc[0, "asal_data"] = "sintetis"
    assert "GAGAL" in tingkat(periksa(df), "asal_data berisi")


def test_kolom_nama_gagal_tetapi_nama_bulan_tidak():
    df = dataset_bersih()
    df["nama_bulan"] = "Juni"
    assert tingkat(periksa(df), "data pribadi") == []
    df["nama"] = "Siti"
    assert "GAGAL" in tingkat(periksa(df), "data pribadi")


def test_nomor_hp_di_catatan_gagal_dan_isinya_tidak_dicetak(capsys):
    df = dataset_bersih()
    df.loc[1, "catatan"] = "hubungi 081234567890"
    temuan = periksa(df)
    gagal = [t for t in temuan if "nomor HP" in t.judul]
    assert gagal and gagal[0].tingkat == "GAGAL"
    assert "B2" in gagal[0].rincian[0]
    assert "0812" not in " ".join(gagal[0].rincian)


def test_status_dp_200_peringatan():
    df = dataset_bersih()
    df.loc[2, "status_pembayaran"] = "dp 200"
    temuan = [t for t in periksa(df) if "status_pembayaran" in t.judul]
    assert temuan[0].tingkat == "PERINGATAN"
    assert "B3" in temuan[0].rincian[0]


def test_bentrok_kode_sama_blok_tumpang_tindih():
    df = dataset_bersih()
    df.loc[1, "tanggal_pemakaian"] = "2026-06-03"  # K1 dipakai 1 Jun dan 3 Jun
    assert "PERINGATAN" in tingkat(periksa(df), "tumpang tindih")


def test_ukuran_di_luar_tabel_peringatan():
    df = dataset_bersih()
    df.loc[0, ["perkiraan_ukuran", "ld_cm"]] = ["M", 70]
    assert "PERINGATAN" in tingkat(periksa(df), "Rentang LD")


def test_minggu_nol_dilaporkan():
    df = dataset_bersih()
    df.loc[2, "tanggal_pemakaian"] = "2026-06-29"  # minggu 15 dan 22 Jun kosong
    temuan = [t for t in periksa(df) if "tanpa pemesanan" in t.judul]
    assert temuan and "2026-06-15" in temuan[0].rincian[0]


def test_kode_keluar(tmp_path):
    bersih = tmp_path / "bersih.csv"
    dataset_bersih().to_csv(bersih, index=False)
    assert main(["--data", str(bersih)]) == 0

    rusak = tmp_path / "rusak.csv"
    dataset_bersih().drop(columns="asal_data").to_csv(rusak, index=False)
    assert main(["--data", str(rusak)]) == 1
