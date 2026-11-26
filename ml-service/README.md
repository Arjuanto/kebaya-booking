# Layanan Model AI — Sistem Pemesanan Sewa Kebaya By Ariegunarti

Capstone Asah 2026 · Tim A26-CS010 · Jalur Next-Gen AI Engineer

Bagian ini mencakup model prediksi permintaan, layanan perkiraan ukuran, dan layanan
REST API yang dipanggil backend aplikasi. Bagian website dan backend ada di repositori
tim Full-Stack.

> Bagian bertanda **TODO** diisi setelah pekerjaannya selesai. Jangan dihapus sebelum diisi:
> semuanya adalah syarat penilaian jalur AI.

---

## 1. Masalah dan pengguna sasaran

**Pengguna sasaran:** admin dan owner Sewa Kebaya By Ariegunarti.

**Masalah:** pencatatan pemesanan dan ketersediaan kebaya masih manual, sehingga satu
kebaya pernah dipesan oleh dua orang pada tanggal yang sama (double booking), terutama
saat musim wisuda dan acara besar. Rekap stok juga memakan waktu.

**Cara masalah ditangani sebelum ada solusi:** admin mencatat pemesanan satu per satu di
spreadsheet setelah customer membayar DP, merekap sisa kebaya secara manual, dan saat
terjadi bentrok admin menawarkan kebaya lain kepada customer. Perkiraan kebutuhan stok
dilakukan berdasarkan ingatan dan pengalaman, tanpa ringkasan data.

**Peran model di solusi:** model memperkirakan jumlah pemesanan pada bulan yang diminta
(dihitung dari prediksi mingguan) agar admin dapat menyiapkan stok lebih terarah. Model TIDAK menentukan ketersediaan
kebaya; pencegahan double booking sepenuhnya dilakukan aturan di backend dan database.

---

## 2. Sumber data dan library

### Data

| Sumber | Keterangan |
|---|---|
| Spreadsheet pemesanan UMKM | TODO: periode dan jumlah baris asli. Kolom nama pelanggan dihapus sebelum dipakai |
| Data contoh buatan tim | TODO: jumlah baris, aturan pembuatan, dan asumsinya |
| Kolom tambahan tim | TODO: daftar kolom yang tidak berasal dari spreadsheet asli |
| Tabel ukuran (`config/size_table.json`) | TODO: konfirmasi apakah rentang berasal dari katalog owner atau asumsi tim |
| Kalender minggu acara (`config/event_weeks.json`) | TODO: isi hanya jika jadwalnya dari sumber nyata; kosongkan kalau tidak ada |

Setiap baris dataset punya kolom `asal_data` bernilai `asli` atau `contoh`. Data contoh
tidak pernah dipakai untuk menarik kesimpulan tentang usaha UMKM.

### Library

Daftar lengkap beserta versinya ada di `requirements.txt`. Yang utama: pandas,
scikit-learn, joblib, FastAPI, uvicorn, pydantic.

---

## 3. Preprocessing

Pembersihan data (data wrangling) dikerjakan tim Data Science. Bagian ini mengubah data
bersih menjadi masukan model.

| Langkah | Alasan |
|---|---|
| Agregasi per minggu (mulai Senin) | Target yang diprediksi adalah jumlah pemesanan per minggu; per hari terlalu banyak nol dan bergerombol |
| Minggu tanpa pemesanan diisi 0 | Nilainya memang nol, bukan data hilang |
| Fitur: bulan, minggu ke-, penanda minggu acara | Informasi yang sudah diketahui sebelum minggu berjalan |
| "Jumlah hari akhir pekan" tidak dipakai | Setiap minggu penuh selalu punya 2 hari akhir pekan, jadi nilainya sama untuk semua baris |
| Bulan di-encode sebagai kategori | Januari bukan "lebih kecil" daripada Desember |
| Penskalaan untuk model linear | Agar skala antar fitur tidak timpang |
| Pipeline hanya dipelajari dari data latih | Mencegah kebocoran data uji |
| Minggu dengan lonjakan besar tidak dibuang | Itu pola asli hari acara; membuang data tanpa alasan dilarang aturan program |

Pemilihan model dilakukan **manual**, tanpa AutoML.

---

## 4. Perbandingan model

Pemisahan data berdasarkan waktu (bukan acak). Metrik dihitung pada **data asli**.

- Data latih: TODO
- Data uji: TODO
- Metrik: MAE dan RMSE

| Model | MAE | RMSE | Catatan |
|---|---|---|---|
| Baseline (rata-rata data latih) | TODO | TODO | Pembanding wajar |
| Ridge | TODO | TODO | |
| Random Forest | TODO | TODO | |

**Model yang dipilih:** TODO, beserta alasannya.

Jalankan ulang perbandingan ini dengan:

```bash
python -m src.train --data ../data/raw/<berkas>.csv --cutoff 2026-10-01
python -m src.train --data ../data/raw/<berkas>.csv --cutoff 2026-10-01 --sumber semua
```

Model terbaik dipilih dari evaluasi pada data uji, lalu konfigurasi yang sama dilatih
ulang pada **semua** minggu sebelum disimpan, supaya model yang di-deploy juga belajar dari
minggu terbaru. `maeValidasi` tetap berasal dari evaluasi sebelum pelatihan ulang. Tambahkan
`--tanpa-refit` untuk menyimpan model versi evaluasi saja.

Proporsi ukuran untuk memecah prediksi bulanan dihitung dari kolom `perkiraan_ukuran`
pada baris yang dipelajari model final (ubah dengan `--kolom-ukuran`). **TODO:** pastikan ke tim Data Science
apakah kolom lingkar dada pada data asli memang dari spreadsheet owner atau dilengkapi
tim (dataset punya kolom `atribut_dilengkapi`). Kalau dilengkapi tim, tulis di sini bahwa
pecahan per ukuran berasal dari atribut buatan tim.

Opsi `--sumber` membandingkan model yang dilatih dari data asli saja dengan yang dilatih
dari data asli ditambah data contoh. Evaluasi selalu memakai data asli.

---

## 5. Menjalankan layanan

Kontrak lengkap ada di `docs/api-contract.md` bagian 5. Semua perintah dijalankan dari
dalam folder `ml-service/`. Lingkungan Python (`.venv`) sudah ada di akar repositori,
jadi tidak perlu membuat yang baru.

```bash
# Windows (PowerShell), dari folder ml-service
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env             # lalu isi API_KEY

uvicorn app.main:app --reload      # http://127.0.0.1:8000/docs
pytest -q                          # menjalankan uji
```

Endpoint:

| Endpoint | Kunci | Fungsi |
|---|---|---|
| `GET /v1/health` | tidak | Cek layanan hidup. Backend memanggilnya saat menyala dan tiap 10 menit agar layanan tidak tertidur |
| `POST /v1/size-estimate` | `X-API-Key` | Perkiraan ukuran dari tabel ukuran (aturan, bukan model) |
| `POST /v1/predict/demand` | `X-API-Key` | Prediksi jumlah pemesanan untuk satu bulan |

Contoh:

```bash
curl -X POST http://127.0.0.1:8000/v1/size-estimate \
  -H "Content-Type: application/json" -H "X-API-Key: <API_KEY>" \
  -d '{"ld": 88, "tb": 158, "bb": 52}'
# {"size":"S","inRange":true,"message":"Perkiraan ukuran S berdasarkan tabel ukuran","tableVersion":"sementara-1"}

curl -X POST http://127.0.0.1:8000/v1/predict/demand \
  -H "Content-Type: application/json" -H "X-API-Key: <API_KEY>" \
  -d '{"targetMonth": "2026-12"}'
```

**Cara prediksi bulanan dihitung.** Model dilatih per minggu karena data asli terlalu
sedikit untuk dilatih per bulan. Angka bulanan adalah jumlah prediksi mingguan untuk
minggu-minggu yang Seninnya jatuh di bulan itu. Angka per ukuran **bukan** keluaran
model: total bulanan dipecah memakai proporsi ukuran historis dari data latih, dan
response menandainya lewat `sizeBreakdown: "proporsi_historis"`.

`note` bernilai `null`, kecuali bulan target tidak ada di data asli yang dipelajari model.
Dalam kasus itu `note` berisi peringatan bahwa angkanya hanya gambaran kasar. Jika kolom
ukuran tidak tersedia saat pelatihan, `sizeBreakdown` bernilai `tidak_tersedia` dan
`predictions` hanya berisi satu baris `TOTAL`.

`/health` (tanpa versi) masih dijawab sebagai alias tersembunyi, hanya supaya pengaturan
health check Render yang lama tidak gagal. Pengaturan Render sebaiknya diganti ke `/v1/health`.

Semua error memakai format kontrak bagian 1.2:

```json
{ "status": "fail", "code": "VALIDATION_ERROR", "message": "Data yang dikirim tidak valid",
  "errors": [ { "field": "ld", "message": "Lingkar dada harus angka antara 60 dan 150" } ] }
```

| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input kosong, bukan angka, di luar rentang, atau `targetMonth` bukan `YYYY-MM` |
| 401 | `UNAUTHORIZED` | `X-API-Key` hilang atau salah |
| 404 | `NOT_FOUND` | Endpoint tidak ada |
| 503 | `MODEL_UNAVAILABLE` | Model belum termuat dan `ALLOW_STUB=false` |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga (detail tidak dikirim ke pemanggil) |

Selama `models/model.joblib` belum ada dan `ALLOW_STUB=true`, endpoint prediksi menjawab
angka tiruan agar backend bisa menyambung lebih dulu. Angka tiruan ditandai
`sizeBreakdown: "tiruan"` dan `note` berisi peringatan; jangan dipakai saat demonstrasi.

---

## 6. Fitur generatif: ringkasan temuan

Fitur ini **pendamping**, bukan pengganti model utama. Angka prediksi tetap berasal dari
model yang dilatih sendiri; layanan generatif hanya mengubah angka menjadi kalimat.
Kalau layanan generatif gagal, prediksi tetap tampil.

- Penyedia: TODO
- Pemanggilan: hanya dari backend. Website tidak memanggil layanan AI secara langsung.
- Kunci API: disimpan di variabel lingkungan, tidak pernah masuk repositori.
- Riwayat ringkasan disimpan di database; saat API lambat atau kuota habis, ringkasan
  terakhir yang tersimpan tetap ditampilkan.
- Prompt: TODO, sertakan larangan menyimpulkan di luar angka yang diberikan dan kewajiban
  menyebut bila data berasal dari data contoh.

---

## 7. Batasan dan etika

- Hasil prototype ini untuk demonstrasi dan validasi, bukan sistem operasional.
- Data asli hanya mencakup sekitar lima bulan, sehingga pola musiman setahun belum dapat
  dipelajari model.
- Lonjakan pemesanan pada minggu acara sulit diprediksi tanpa informasi jadwal acara.
- Sebagian dataset adalah data contoh buatan tim; metrik yang dilaporkan berasal dari
  data asli, dan data contoh tidak dipakai untuk menyimpulkan kondisi usaha.
- Perkiraan ukuran adalah aturan berbasis tabel, bukan model yang dilatih.
- Tidak ada data pribadi pelanggan di repositori, notebook, maupun materi demonstrasi.

---

## Struktur repositori

Folder ini (`ml-service/`) berisi seluruh bagian jalur AI:

```
app/        layanan FastAPI (endpoint, skema, error, keamanan)
src/        preprocessing, aturan ukuran, skrip pelatihan
config/     tabel ukuran dan kalender minggu acara (bisa diganti tanpa ubah kode)
models/     artefak model hasil pelatihan (tidak di-commit)
tests/      uji layanan
```

Dataset dan notebook memakai folder bersama di akar repositori: `../data/` dan `../notebooks/`.
