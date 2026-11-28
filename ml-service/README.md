# Layanan Model AI — Sistem Pemesanan Sewa Kebaya By Ariegunarti

Capstone Asah 2026 · Tim A26-CS010 · Jalur Next-Gen AI Engineer

Bagian ini mencakup model prediksi permintaan, layanan perkiraan ukuran, dan layanan
REST API yang dipanggil backend aplikasi. Bagian website dan backend ada di repositori
tim Full-Stack.

> Bagian bertanda **TODO** diisi setelah pekerjaannya selesai. Jangan dihapus sebelum diisi:
> semuanya adalah syarat penilaian jalur AI.

---

## 1. Masalah dan pengguna sasaran

Sumber bagian ini: wawancara dengan owner pada 19 Oktober 2026, jawaban lanjutan owner
lewat WhatsApp, dan dokumen use case yang sudah disetujui Asah. Hal yang merupakan usulan
tim, bukan keterangan owner, ditandai *(usulan tim)*.

### Masalah

Sewa Kebaya By Ariegunarti menyewakan kebaya dan pakaian couple, terutama untuk wisuda.
Pemesanan masuk lewat WhatsApp, lalu admin mencatatnya sendiri. Karena pencatatan dan
rekap ketersediaan dilakukan manual, **satu kebaya bisa tercatat dipesan oleh dua orang
untuk tanggal yang sama (double booking)**. Menurut owner, hal ini paling sering terjadi
pada hari wisuda dan acara ramai, ketika admin harus membalas chat satu per satu sambil
merekap sisa kebaya dan jadwal fitting.

Owner memilih masalah ini sebagai prioritas karena paling berdampak pada stok kebaya dan
dalam jangka panjang dapat menurunkan kepercayaan customer.

### Pengguna sasaran

| Pengguna | Peran dalam alur | Yang didapat dari bagian AI |
|---|---|---|
| **Admin** (pengguna utama) | Meninjau pengajuan, memastikan kebaya muat, mencatat DP dan status sewa | Perkiraan jumlah pemesanan bulan berikutnya dan ringkasan temuan dalam bahasa sederhana di halaman admin |
| **Owner** (pengguna utama) | Mengambil keputusan soal stok dan persiapan musim ramai | Perkiraan yang sama untuk bahan pertimbangan |
| Customer (pengguna lain) | Mengisi tanggal pemakaian dan ukuran badan lalu mengirim pengajuan lewat website *(usulan tim)* | Perkiraan ukuran (S, M, L, dan seterusnya) dari lingkar dada, sebagai petunjuk awal sebelum fitting |

### Cara masalah ditangani sebelum ada solusi

1. Customer melihat katalog di Instagram, lalu menghubungi admin lewat WhatsApp. Katalog
   lengkap juga dikirim manual lewat WhatsApp.
2. Admin mengecek ketersediaan kebaya dari catatan manual. Kebaya tidak
   bisa ditahan tanpa DP; siapa yang lebih dulu membayar DP 50%, dia yang mendapatkannya.
3. Kecocokan ukuran dipastikan lewat chat dan fitting, dibantu freelance saat ramai.
   Owner tidak memiliki tabel ukuran yang baku.
4. Setelah DP dibayar, admin mencatat pemesanan di spreadsheet dengan lima kolom: nama,
   waktu pemakaian, kode kebaya, status pembayaran (DP atau lunas), dan catatan permintaan
   customer. Pelunasan dilakukan H-1.
5. Sisa kebaya dan jadwal fitting direkap manual.
6. Jika terjadi double booking, admin menawarkan kebaya lain kepada salah satu customer.
   Cara ini sepenuhnya bergantung pada ketelitian admin.

Spreadsheet tersebut hanya berisi catatan per pemesanan, tanpa ringkasan otomatis. Pola
pemesanan per bulan atau per minggu belum pernah dilihat dalam bentuk data; yang diketahui
owner adalah bahwa pemesanan paling ramai saat wisuda dan acara besar.

### Peran bagian AI di solusi

| Komponen | Membantu apa | Bukan untuk apa |
|---|---|---|
| Prediksi permintaan (`/v1/predict/demand`) | Memperkirakan jumlah pemesanan pada bulan yang diminta (jumlah dari prediksi mingguan), dibagi per ukuran, agar admin dapat menyiapkan stok sebelum musim ramai | Tidak menentukan kebaya mana yang tersedia |
| Perkiraan ukuran (`/v1/size-estimate`) | Memberi petunjuk ukuran awal kepada customer dari lingkar dada | Tidak menggantikan fitting. Ini aturan tabel, bukan model |
| Ringkasan temuan (fitur generatif) | Menjelaskan angka prediksi dalam 3 sampai 5 kalimat sederhana untuk admin | Tidak menyimpulkan hal di luar angka yang diberikan |

**Pencegahan double booking tidak bergantung pada model.** Aturannya dijalankan oleh
backend dan database: kebaya yang sudah tercatat DP tidak bisa diajukan lagi pada periode
sewa yang sama. Bagian AI hanya pendukung. Jika layanan ini mati, pemesanan tetap berjalan
dan halaman admin menampilkan pesan bahwa prediksi sedang tidak tersedia.

---

## 2. Sumber data dan library

### Data

| Sumber | Keterangan |
|---|---|
| Spreadsheet pemesanan UMKM | TODO: periode dan jumlah baris asli. Kolom nama pelanggan dihapus sebelum dipakai |
| Data contoh buatan tim | TODO: jumlah baris, aturan pembuatan, dan asumsinya |
| Kolom tambahan tim | TODO: daftar kolom yang tidak berasal dari spreadsheet asli |
| Tabel ukuran (`config/size_table.json`) | **Asumsi tim**, bukan dari owner. Owner menyatakan tidak memiliki ukuran baku. Versi saat ini `sementara-1` berisi rentang lingkar dada yang disusun tim. TODO: selaraskan dengan rentang ukuran pada dataset final tim Data Science (29 Nov 2026) |
| Kalender minggu acara (`config/event_weeks.json`) | Saat ini kosong karena belum ada jadwal acara dari sumber nyata. TODO: isi jika owner atau jadwal wisuda kampus resmi memberikan tanggalnya |

Setiap baris dataset punya kolom `asal_data` bernilai `asli` atau `contoh`. Data contoh
tidak pernah dipakai untuk menarik kesimpulan tentang usaha UMKM.

### Library

Semua versi dikunci, supaya laptop dan Render memakai library yang persis sama. Ini
penting karena berkas model `.joblib` hanya aman dimuat oleh versi scikit-learn yang sama
dengan saat dilatih.

| Berkas | Isi | Dipasang di |
|---|---|---|
| `requirements.txt` | Library layanan, versi dikunci | Render dan laptop |
| `requirements-dev.txt` | Isi `requirements.txt` ditambah pytest, httpx, matplotlib, Jupyter Notebook | Laptop saja |
| `requirements.in`, `requirements-dev.in` | Daftar library tanpa versi, sumber kedua berkas di atas | Tidak dipasang |

Library utama: pandas 3.1.1, numpy 2.4.6, scikit-learn 1.9.1, joblib 1.6.0, FastAPI 0.165.0,
uvicorn 0.54.0, pydantic 2.14.4. Versi Python: **3.11** (laptop 3.11.4; Render diatur lewat
variabel `PYTHON_VERSION`, lihat bagian 5). numpy dibatasi di bawah 2.5 karena numpy 2.5 tidak
lagi mendukung Python 3.11.

Untuk menambah atau memperbarui library, ubah berkas `.in`, lalu buat ulang berkas yang dikunci:

```bash
pip install uv
uv pip compile requirements.in --universal --python-version 3.11 -o requirements.txt
uv pip compile requirements-dev.in --universal --python-version 3.11 -o requirements-dev.txt
```

---

## 3. Preprocessing

Pembersihan data (data wrangling) dikerjakan tim Data Science. Bagian ini mengubah data
bersih menjadi masukan model.

| Langkah | Alasan |
|---|---|
| Agregasi per minggu (mulai Senin) | Target yang diprediksi adalah jumlah pemesanan per minggu; per hari terlalu banyak nol dan bergerombol |
| Minggu tanpa pemesanan diisi 0 | Nilainya memang nol, bukan data hilang |
| Fitur: bulan dan penanda minggu acara | Informasi yang sudah diketahui sebelum minggu berjalan |
| "Minggu ke-" (nomor minggu dalam setahun) tidak dipakai | Data asli berakhir di minggu ke-45 tepat setelah lonjakan terbesar, sehingga model membaca minggu sesudahnya sebagai kelanjutan lonjakan. Saat diuji, prediksi Desember melambung sekitar dua kali bulan tersibuk, pada Ridge maupun Random Forest (lihat `notebooks/eksplorasi_permintaan.ipynb`) |
| "Jumlah hari akhir pekan" tidak dipakai | Setiap minggu penuh selalu punya 2 hari akhir pekan, jadi nilainya sama untuk semua baris |
| Bulan di-encode sebagai kategori | Januari bukan "lebih kecil" daripada Desember |
| Penskalaan penanda minggu acara | Agar skala antar fitur tidak timpang pada model linear |
| Pipeline hanya dipelajari dari data latih | Mencegah kebocoran data uji |
| Minggu dengan lonjakan besar tidak dibuang | Itu pola asli hari acara; membuang data tanpa alasan dilarang aturan program |

Pemilihan model dilakukan **manual**, tanpa AutoML.

**Sebelum melatih, periksa dataset dulu:**

```bash
python -m src.check_dataset --data ../data/raw/<berkas>.csv
```

Skrip ini memeriksa kolom wajib, tanggal, nilai `asal_data`, data pribadi (kolom nama,
nomor HP, email, akun media sosial di kolom teks), status pembayaran, baris kembar, kolom
bernilai tetap, bentrok jadwal per kode kebaya, kecocokan rentang lingkar dada dengan
`config/size_table.json`, dan minggu data asli tanpa pemesanan. Temuan `GAGAL` berarti
dataset dikembalikan ke tim Data Science sebelum dipakai. Laporan hanya menampilkan
`id_booking` baris yang bermasalah, bukan isi kolomnya.

---

## 4. Perbandingan model

**Evaluasi bergulir, bukan pemisahan acak.** Untuk setiap minggu uji, model dilatih memakai
semua minggu sebelumnya lalu memprediksi minggu itu. Data asli hanya sekitar 23 minggu, jadi
cara ini memberi lebih banyak titik uji daripada satu kali pemisahan, tanpa memakai data masa
depan. Metrik selalu dihitung pada **data asli**.

- Minggu uji pertama (`--cutoff`): TODO
- Jumlah minggu uji: TODO
- Metrik: MAE dan RMSE per minggu

| Model | MAE | RMSE | Catatan |
|---|---|---|---|
| Pembanding: rata-rata minggu sebelumnya | TODO | TODO | Tanpa model |
| Pembanding: sama dengan minggu lalu | TODO | TODO | Tanpa model |
| Ridge | TODO | TODO | |
| Random Forest | TODO | TODO | |

Kalau model tidak mengalahkan kedua pembanding, tulis apa adanya beserta sebabnya. Itu temuan
yang sah, dan menyembunyikannya melanggar aturan program.

**Model yang dipilih:** TODO, beserta alasannya.

Jalankan ulang perbandingan ini dengan:

```bash
python -m src.train --data ../data/raw/<berkas>.csv --cutoff 2026-08-10
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

Opsi `--sumber semua` melatih model dari data asli ditambah data contoh; evaluasi tetap
memakai data asli. Pada dataset draf, data contoh membuat MAE pada data asli hampir dua kali
lipat, karena polanya (merata sepanjang minggu) berbeda dari pola asli (bergerombol pada minggu
acara). Karena itu bawaannya `--sumber asli`. Jalankan ulang perbandingan ini dengan dataset final.

---

## 5. Menjalankan layanan

Kontrak lengkap ada di `docs/api-contract.md` bagian 5. Semua perintah dijalankan dari
dalam folder `ml-service/`. Lingkungan Python (`.venv`, Python 3.11) ada di akar repositori.

```bash
# Windows (PowerShell), dari folder ml-service
..\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt   # di laptop: layanan + tes + notebook
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

**Render.** Build command `pip install -r requirements.txt` (tanpa paket pengembangan).
Variabel lingkungan di Render:

| Variabel | Nilai | Alasan |
|---|---|---|
| `PYTHON_VERSION` | `3.11.4` | Tanpa ini Render memakai Python bawaan yang lebih baru, sehingga versi library bisa berbeda dari laptop tempat model dilatih |
| `API_KEY` | kunci acak, sama dengan `ML_API_KEY` di backend | **Wajib.** Kalau kosong, semua endpoint selain `/v1/health` menjawab 401, jadi layanan tertutup, bukan terbuka |
| `ALLOW_STUB` | `false` begitu `models/model.joblib` sudah di-commit | Supaya angka tiruan tidak pernah muncul saat demo. Kalau model hilang atau gagal dimuat, prediksi menjawab 503 dan halaman admin menampilkan "Prediksi sedang tidak tersedia" |

**Berkas model ikut di-commit.** Render mengambil kode dari GitHub, jadi `models/model.joblib`
dan `models/metrics.json` disimpan di repositori. Isinya hanya koefisien model, proporsi
ukuran, dan ringkasan evaluasi dari jumlah pemesanan mingguan, tanpa nama atau data per
pelanggan. Dataset tetap tidak di-commit.

**Kalau model gagal dimuat** (berkas rusak, atau dilatih dengan versi scikit-learn lain),
layanan tetap menyala: `/v1/size-estimate` berjalan normal, `/v1/health` menampilkan
`"demand": "gagal-dimuat"`, dan penyebabnya tercatat di log Render.

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
| 401 | `UNAUTHORIZED` | `X-API-Key` hilang atau salah, atau `API_KEY` belum diisi di server |
| 404 | `NOT_FOUND` | Endpoint tidak ada |
| 503 | `MODEL_UNAVAILABLE` | Model tidak ada atau gagal dimuat, dan `ALLOW_STUB=false` |
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
- Lonjakan pemesanan pada minggu acara sulit diprediksi tanpa informasi jadwal acara. Selama
  `config/event_weeks.json` kosong, model hanya mengandalkan bulan.
- Untuk bulan yang tidak ada di data asli, layanan tetap memberi angka, tetapi menyertakan
  `note` bahwa angkanya hanya gambaran kasar.
- Sebagian dataset adalah data contoh buatan tim; metrik yang dilaporkan berasal dari
  data asli, dan data contoh tidak dipakai untuk menyimpulkan kondisi usaha.
- Perkiraan ukuran adalah aturan berbasis tabel, bukan model yang dilatih.
- Tidak ada data pribadi pelanggan di repositori, notebook, maupun materi demonstrasi.

---

## Struktur repositori

Folder ini (`ml-service/`) berisi seluruh bagian jalur AI:

```
app/        layanan FastAPI (endpoint, skema, error, keamanan)
src/        preprocessing, aturan ukuran, skrip pelatihan, pemeriksa dataset
config/     tabel ukuran dan kalender minggu acara (bisa diganti tanpa ubah kode)
models/     model.joblib dan metrics.json hasil pelatihan (di-commit untuk Render)
tests/      uji layanan dan pemeriksa dataset
```

Dataset dan notebook memakai folder bersama di akar repositori: `../data/` dan `../notebooks/`.
