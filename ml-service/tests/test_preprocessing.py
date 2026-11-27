"""Uji pengelompokan per minggu (src/preprocessing.py).

Angka mingguan inilah yang dipelajari model, jadi pergeseran satu hari ke minggu yang
salah harus membuat tes gagal, termasuk bila perilaku pandas berubah di versi lain.
"""

import pandas as pd

from src.preprocessing import mondays_in_month, to_weekly


def test_minggu_dimulai_senin_dan_minggu_kosong_bernilai_nol():
    df = pd.DataFrame(
        {
            "tanggal_pemakaian": pd.to_datetime(
                [
                    "2026-11-16",  # Senin
                    "2026-11-29",  # Minggu: masih minggu yang dimulai 23 Nov
                    "2026-11-30",  # Senin: minggu baru
                    "2026-12-14",  # minggu 7 Des tidak punya pemesanan
                ]
            ),
            "asal_data": ["asli"] * 4,
        }
    )
    hasil = to_weekly(df).set_index("week_start")["n_bookings"]
    assert hasil.to_dict() == {
        pd.Timestamp("2026-11-16"): 1,
        pd.Timestamp("2026-11-23"): 1,
        pd.Timestamp("2026-11-30"): 1,
        pd.Timestamp("2026-12-07"): 0,
        pd.Timestamp("2026-12-14"): 1,
    }
    assert all(d.day_of_week == 0 for d in hasil.index)


def test_hanya_data_asli():
    df = pd.DataFrame(
        {
            "tanggal_pemakaian": pd.to_datetime(["2026-11-16", "2026-11-17", "2026-11-18"]),
            "asal_data": ["asli", "contoh", "asli"],
        }
    )
    assert to_weekly(df, only_origin="asli")["n_bookings"].tolist() == [2]


def test_senin_dalam_bulan():
    assert [d.day for d in mondays_in_month("2026-11")] == [2, 9, 16, 23, 30]
    assert [d.day for d in mondays_in_month("2026-10")] == [5, 12, 19, 26]
