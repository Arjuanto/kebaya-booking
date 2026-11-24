# Kontrak API — Sewa Kebaya By Ariegunarti (A26-CS010)

Status: **DRAFT v0.2** — perlu disepakati FS (Arjuanto, Diva, David) dan AE (Ilham) sebelum pengembangan, sesuai jadwal Minggu 1 (23–29 Nov 2026).

Dokumen ini mencakup dua kontrak:

1. **Backend REST API (Express)** — dipanggil website (React + Axios).
2. **Layanan model (FastAPI)** — dipanggil **hanya oleh backend**, bukan oleh website.

```
Website (React) ──Axios──▶ Backend Express /api/v1 ──▶ PostgreSQL (Neon)
                                    │
                                    ├──▶ Layanan model FastAPI (Render)  → perkiraan ukuran, prediksi
                                    └──▶ API AI generatif (Gemini)       → ringkasan temuan
```

---

## 1. Konvensi umum

| Hal | Aturan |
|---|---|
| Base URL backend | `https://<backend>.onrender.com/api/v1` |
| Format | JSON (`Content-Type: application/json`) |
| Tanggal | `YYYY-MM-DD`, tanpa jam. "Hari ini" selalu dihitung di zona Asia/Jakarta, **bukan** dari jam server (server Render memakai UTC, 7 jam di belakang WIB) |
| Waktu | ISO 8601, mis. `2026-12-01T10:15:00+07:00` |
| Nama field | `camelCase` |
| ID | integer |
| Autentikasi admin | Header `Authorization: Bearer <token>` (JWT, berlaku 8 jam) |
| Validasi | Schema validation (Joi) di setiap endpoint yang menerima input |

### 1.1 Format respons sukses

```json
{
  "status": "success",
  "message": "Pengajuan berhasil dikirim",
  "data": { }
}
```

### 1.2 Format respons gagal

```json
{
  "status": "fail",
  "code": "VALIDATION_ERROR",
  "message": "Data yang dikirim tidak valid",
  "errors": [
    { "field": "ld", "message": "Lingkar dada harus angka antara 60 dan 150" }
  ]
}
```

- `status`: `"fail"` untuk kesalahan dari sisi klien (4xx), `"error"` untuk kesalahan server/layanan (5xx).
- `code`: kode mesin, dipakai website untuk memilih pesan/tampilan.
- `message`: pesan dalam bahasa Indonesia yang **boleh langsung ditampilkan** ke pengguna.
- `errors`: hanya ada untuk `VALIDATION_ERROR`.
- `data`: opsional, detail tambahan yang dibutuhkan UI saat error (mis. `data.conflictWith` saat mencatat DP, `data.lastSummary` saat ringkasan AI gagal).
- Tidak ada field lain di level atas selain `status`, `code`, `message`, `errors`, dan `data`.

### 1.3 Daftar kode error

| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input kosong, salah format, atau di luar rentang |
| 401 | `UNAUTHORIZED` | Token tidak ada / salah / kedaluwarsa, atau login gagal |
| 404 | `NOT_FOUND` | Kebaya / pengajuan / ringkasan tidak ditemukan |
| 409 | `KEBAYA_NOT_AVAILABLE` | Kebaya sudah terkonfirmasi DP pada periode yang tumpang tindih, atau kebaya nonaktif |
| 409 | `INVALID_STATUS_TRANSITION` | Urutan status salah (mis. pengembalian sebelum penyerahan) |
| 409 | `DUPLICATE_CODE` | Kode kebaya sudah dipakai |
| 429 | `TOO_MANY_ATTEMPTS` | Login gagal 5 kali dari IP yang sama dalam 15 menit |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga di backend |
| 502 | `ML_SERVICE_ERROR` | Layanan model membalas error / tidak bisa dihubungi |
| 503 | `AI_UNAVAILABLE` | API AI generatif gagal (key salah, layanan down) |
| 503 | `AI_QUOTA_EXCEEDED` | Kuota API AI generatif habis (masalah di sisi server, bukan kesalahan pengguna) |
| 504 | `ML_TIMEOUT` / `AI_TIMEOUT` | Layanan model / AI terlalu lama membalas |

---

## 2. Model data

### 2.1 Kebaya

```json
{
  "id": 12,
  "code": "KB-012",
  "name": "Kebaya Kutubaru Hijau Sage",
  "category": "kebaya",
  "size": "M",
  "photoUrl": "https://.../kb-012.jpg",
  "description": "Brokat, cocok untuk wisuda",
  "isActive": true,
  "createdAt": "2026-11-25T09:00:00+07:00",
  "updatedAt": "2026-11-25T09:00:00+07:00"
}
```

| Field | Tipe | Aturan |
|---|---|---|
| `code` | string | wajib, unik, maks 20 karakter |
| `name` | string | wajib, maks 100 |
| `category` | enum | `kebaya` \| `kemeja_couple` |
| `size` | enum | `S` \| `M` \| `L` \| `XL` \| `XXL` \| `ALL_SIZE` (menyesuaikan tabel ukuran owner) |
| `photoUrl` | string (URL) | wajib; unggah file **tidak** termasuk MVP, admin menempel URL foto |
| `description` | string | opsional, maks 500 |
| `isActive` | boolean | default `true`; kebaya nonaktif tidak tampil di sisi customer |

### 2.2 Pengajuan (Booking)

```json
{
  "id": 45,
  "customerName": "Sinta",
  "useDate": "2026-12-20",
  "eventPurpose": "wisuda",
  "ld": 88,
  "tb": 158,
  "bb": 52,
  "estimatedSize": "M",
  "kebaya": { "id": 12, "code": "KB-012", "name": "Kebaya Kutubaru Hijau Sage" },
  "status": "pending",
  "needsFitting": null,
  "rentalPeriod": { "start": "2026-12-19", "end": "2026-12-23" },
  "dpAmount": null,
  "dpPaidAt": null,
  "paidOffAt": null,
  "handedOverAt": null,
  "returnedAt": null,
  "adminNote": null,
  "hasDuplicate": false,
  "duplicateWith": [],
  "createdAt": "2026-12-01T10:15:00+07:00",
  "updatedAt": "2026-12-01T10:15:00+07:00"
}
```

| Field | Aturan validasi |
|---|---|
| `customerName` | wajib, 2–100 karakter, tidak boleh hanya spasi |
| `useDate` | wajib, format tanggal valid, **tidak boleh hari ini atau lampau** (dibandingkan dengan tanggal hari ini di Asia/Jakarta) |
| `eventPurpose` | wajib, enum: `wisuda` \| `kartini` \| `pernikahan` \| `lamaran` \| `lainnya` |
| `ld` (lingkar dada, cm) | wajib, angka 60–150 |
| `tb` (tinggi badan, cm) | wajib, angka 130–200 |
| `bb` (berat badan, kg) | wajib, angka 30–150 |
| `kebayaId` | wajib, kebaya aktif |

> Rentang LD/TB/BB di atas adalah **batas kewajaran input**, bukan tabel ukuran. Perkiraan ukuran tetap berasal dari tabel ukuran owner di layanan model.

### 2.3 Status pengajuan

```
pending ──▶ dp_paid ──▶ paid_off ──▶ handed_over ──▶ returned
   │           │
   └──▶ rejected   └──▶ cancelled
```

| `status` | Label di UI | Memblokir ketersediaan? |
|---|---|---|
| `pending` | Menunggu | Tidak (hanya ditandai jika ganda) |
| `rejected` | Ditolak | Tidak |
| `dp_paid` | DP tercatat | **Ya** |
| `paid_off` | Lunas | **Ya** |
| `handed_over` | Diserahkan | **Ya** |
| `returned` | Dikembalikan | **Ya** (sampai akhir jeda laundry) |
| `cancelled` | Dibatalkan | Tidak |

Transisi selain panah di atas → `409 INVALID_STATUS_TRANSITION`.

### 2.4 Aturan masa sewa dan ketersediaan

- `rentalPeriod.start = useDate − RENTAL_DAYS_BEFORE` (default 1 hari)
- `rentalPeriod.end   = useDate + RENTAL_DAYS_AFTER + LAUNDRY_DAYS` (default 1 + 2 hari)
- Ketiga angka adalah **variabel lingkungan** backend (asumsi sampai dikonfirmasi owner).
- Kebaya **tidak tersedia** untuk `useDate` X jika ada pengajuan berstatus pemblokir pada kebaya yang sama yang `rentalPeriod`-nya tumpang tindih dengan `rentalPeriod` dari X (`startA <= endB AND startB <= endA`).
- **Pengajuan ganda**: dua atau lebih pengajuan `pending` untuk kebaya yang sama dengan periode tumpang tindih → `hasDuplicate: true`, `duplicateWith` berisi ID pengajuan lainnya.
- Saat DP dicatat, backend memeriksa ulang tumpang tindih **di dalam satu transaksi database** (dengan row lock pada kebaya), sehingga dua pencatatan DP bersamaan tidak bisa sama-sama berhasil.

---

## 3. Endpoint publik (customer)

### `GET /health`

Cek backend hidup (juga untuk "membangunkan" Render sebelum demo).

**200**
```json
{ "status": "success", "data": { "db": "ok", "mlService": "ok" } }
```
`mlService` bernilai `"down"` jika layanan model tidak membalas — endpoint tetap 200.

---

### `GET /kebaya/available`

Daftar kebaya tersedia pada tanggal pemakaian + perkiraan ukuran.

**Query**

| Param | Wajib | Contoh |
|---|---|---|
| `useDate` | ya | `2026-12-20` |
| `ld` | ya | `88` |
| `tb` | ya | `158` |
| `bb` | ya | `52` |
| `category` | tidak | `kebaya` |

**200**
```json
{
  "status": "success",
  "message": "Ditemukan 14 kebaya tersedia",
  "data": {
    "useDate": "2026-12-20",
    "rentalPeriod": { "start": "2026-12-19", "end": "2026-12-23" },
    "sizeEstimate": {
      "available": true,
      "size": "M",
      "inRange": true,
      "message": "Perkiraan ukuran M berdasarkan tabel ukuran"
    },
    "kebaya": [
      {
        "id": 12,
        "code": "KB-012",
        "name": "Kebaya Kutubaru Hijau Sage",
        "category": "kebaya",
        "size": "M",
        "photoUrl": "https://.../kb-012.jpg",
        "sizeMatch": true
      }
    ]
  }
}
```

- `kebaya` diurutkan: `sizeMatch: true` dulu.
- Jika layanan model gagal/timeout, endpoint **tetap 200**: `sizeEstimate` = `{ "available": false, "size": null, "inRange": null, "message": "Perkiraan ukuran sedang tidak tersedia, silakan hubungi admin untuk fitting" }` dan `sizeMatch` = `null`. Ketersediaan tidak bergantung pada model.
- Jika di luar tabel ukuran: `inRange: false`, `size: null`, `message` meminta customer menghubungi admin / fitting.

**Error**: `400 VALIDATION_ERROR`

---

### `GET /kebaya/:id`

Detail satu kebaya aktif. **404** jika tidak ada atau nonaktif.

---

### `POST /bookings`

Kirim pengajuan pemesanan.

**Request**
```json
{
  "customerName": "Sinta",
  "useDate": "2026-12-20",
  "eventPurpose": "wisuda",
  "ld": 88,
  "tb": 158,
  "bb": 52,
  "kebayaId": 12
}
```

**201**
```json
{
  "status": "success",
  "message": "Pengajuan berhasil dikirim. Admin akan meninjau pengajuan Anda.",
  "data": {
    "id": 45,
    "status": "pending",
    "useDate": "2026-12-20",
    "rentalPeriod": { "start": "2026-12-19", "end": "2026-12-23" },
    "kebaya": { "id": 12, "code": "KB-012", "name": "Kebaya Kutubaru Hijau Sage" },
    "estimatedSize": "M"
  }
}
```

**Error**
- `400 VALIDATION_ERROR` — data kosong/tidak masuk akal (lihat 2.2)
- `404 NOT_FOUND` — `kebayaId` tidak ada
- `409 KEBAYA_NOT_AVAILABLE` — kebaya sudah DP pada periode tumpang tindih atau nonaktif (mencegah kirim langsung lewat API)

`estimatedSize` diisi backend dari layanan model; `null` jika model gagal (pengajuan tetap tersimpan).

---

## 4. Endpoint admin

Semua endpoint di bawah `/admin/*` wajib header `Authorization: Bearer <token>`; tanpa token → `401 UNAUTHORIZED`.

### `POST /auth/login`

**Request**
```json
{ "username": "admin", "password": "••••••" }
```

**200**
```json
{
  "status": "success",
  "message": "Login berhasil",
  "data": { "token": "eyJhbGci...", "expiresIn": 28800, "admin": { "id": 1, "username": "admin" } }
}
```

**401** `UNAUTHORIZED` — pesan generik "Username atau password salah" (tidak membedakan mana yang salah).

**429** `TOO_MANY_ATTEMPTS` — setelah 5 kali login **gagal** dari IP yang sama dalam 15 menit (login yang berhasil tidak dihitung):
```json
{ "status": "fail", "code": "TOO_MANY_ATTEMPTS", "message": "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." }
```
Catatan implementasi: pasang `express-rate-limit` hanya di route ini dengan `skipSuccessfulRequests: true`. Di Render, atur `trust proxy` di Express (mulai dari `1`, lalu pastikan `req.ip` menampilkan IP pengguna). Tanpa itu semua request terlihat datang dari IP proxy Render, sehingga satu penyerang bisa mengunci login untuk semua orang, termasuk admin.

Akun admin dibuat lewat seed database; tidak ada endpoint registrasi.

### `GET /auth/me`

Cek token masih berlaku. **200** → data admin; **401** jika tidak.

---

### Katalog

| Method | Path | Fungsi |
|---|---|---|
| GET | `/admin/kebaya?isActive=&category=&q=` | Semua kebaya, termasuk nonaktif. `q` cari di kode/nama |
| GET | `/admin/kebaya/:id` | Detail |
| POST | `/admin/kebaya` | Tambah (body: field di 2.1 kecuali `id`, `createdAt`, `updatedAt`) → **201** |
| PUT | `/admin/kebaya/:id` | Ubah (body sama dengan POST) → **200** |
| PATCH | `/admin/kebaya/:id/active` | Aktifkan/nonaktifkan, body `{ "isActive": false }` → **200** |

Tidak ada DELETE: kebaya hanya dinonaktifkan agar riwayat pengajuan tetap utuh.
Error: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 DUPLICATE_CODE`.

---

### Pengajuan

#### `GET /admin/bookings`

| Query | Contoh | Keterangan |
|---|---|---|
| `status` | `pending` | boleh koma: `pending,dp_paid` |
| `kebayaId` | `12` | |
| `from`, `to` | `2026-12-01` | filter `useDate` |
| `hasDuplicate` | `true` | hanya yang ditandai ganda |
| `page`, `limit` | `1`, `20` | default 1 dan 20, maks 100 |

**200**
```json
{
  "status": "success",
  "data": {
    "bookings": [ { "...": "objek Booking (2.2)" } ],
    "pagination": { "page": 1, "limit": 20, "total": 37 }
  }
}
```

#### `GET /admin/bookings/:id`

Detail satu pengajuan (objek Booking lengkap). **404** jika tidak ada.

#### `PATCH /admin/bookings/:id/fitting`

```json
{ "needsFitting": true, "adminNote": "Cek lingkar pinggang saat fitting" }
```
Hanya untuk status `pending` atau `dp_paid`; selain itu `409 INVALID_STATUS_TRANSITION`.

#### `PATCH /admin/bookings/:id/status`

Ubah status. Isi body tergantung status tujuan:

| `status` tujuan | Body tambahan | Catatan |
|---|---|---|
| `dp_paid` | `dpAmount` (wajib, > 0), `paidAt` (opsional, default sekarang) | **Cek ulang tumpang tindih dalam transaksi**; bentrok → `409 KEBAYA_NOT_AVAILABLE` |
| `paid_off` | `paidAt` (opsional) | |
| `handed_over` | `at` (opsional) | |
| `returned` | `at` (opsional) | |
| `rejected` | `adminNote` (opsional) | dari `pending` |
| `cancelled` | `adminNote` (opsional) | dari `dp_paid` |

Contoh:
```json
{ "status": "dp_paid", "dpAmount": 50000 }
```

**200** → objek Booking terbaru.
**409 KEBAYA_NOT_AVAILABLE** (contoh skenario double booking):
```json
{
  "status": "fail",
  "code": "KEBAYA_NOT_AVAILABLE",
  "message": "KB-012 sudah terkonfirmasi DP untuk pengajuan #44 pada 19–23 Des 2026. DP tidak dapat dicatat.",
  "data": { "conflictWith": [44] }
}
```

---

### Analisis, prediksi, ringkasan AI

#### `GET /admin/analytics?from=&to=`

Hasil analisis riwayat pemesanan (dari tim DS). Sumber datanya: tabel hasil analisis yang di-*seed* dari output notebook DS (format disepakati dengan Noera/Syahidah).

**200**
```json
{
  "status": "success",
  "data": {
    "dataSource": "asli",
    "period": { "from": "2025-01-01", "to": "2026-10-31" },
    "topKebaya": [ { "code": "KB-012", "name": "Kebaya Kutubaru Hijau Sage", "count": 18 } ],
    "busyPeriods": [ { "label": "Wisuda Oktober", "month": "2026-10", "count": 41 } ],
    "recommendations": [ "Siapkan ukuran M dan L lebih banyak menjelang wisuda Oktober" ],
    "generatedAt": "2026-12-05T08:00:00+07:00"
  }
}
```
`dataSource`: `asli` \| `contoh` \| `campuran` — wajib tampil di UI (aturan label data).

#### `GET /admin/predictions?targetMonth=2027-04`

Backend meneruskan ke layanan model `POST /v1/predict/demand`.

**200**
```json
{
  "status": "success",
  "data": {
    "targetMonth": "2027-04",
    "model": { "name": "random_forest", "version": "1.0.0" },
    "dataSource": "campuran",
    "predictions": [
      { "size": "M", "predictedCount": 12 },
      { "size": "L", "predictedCount": 9 }
    ]
  }
}
```
**502 ML_SERVICE_ERROR / 504 ML_TIMEOUT** — halaman admin tetap terbuka dan menampilkan `message` ("Prediksi sedang tidak tersedia").

#### `POST /admin/ai-summaries`

Buat ringkasan temuan baru. Backend menyusun prompt terstruktur dari `analytics` + `predictions`, memanggil API AI generatif, lalu **menyimpan hasilnya ke database**.

**Request**
```json
{ "from": "2025-01-01", "to": "2026-10-31", "targetMonth": "2027-04" }
```

**201**
```json
{
  "status": "success",
  "message": "Ringkasan berhasil dibuat",
  "data": {
    "id": 7,
    "summary": "Permintaan tertinggi terjadi saat wisuda Oktober...",
    "provider": "gemini",
    "model": "gemini-x",
    "input": { "from": "2025-01-01", "to": "2026-10-31", "targetMonth": "2027-04" },
    "createdAt": "2026-12-10T14:00:00+07:00"
  }
}
```

**Error** — selalu menyertakan ringkasan terakhir yang tersimpan (jika ada) agar UI tetap punya isi:
```json
{
  "status": "error",
  "code": "AI_TIMEOUT",
  "message": "Layanan AI sedang lambat. Menampilkan ringkasan terakhir.",
  "data": { "lastSummary": { "id": 6, "summary": "...", "createdAt": "2026-12-08T10:00:00+07:00" } }
}
```
Kode: `503 AI_QUOTA_EXCEEDED`, `503 AI_UNAVAILABLE`, `504 AI_TIMEOUT`. Percobaan yang gagal juga dicatat di riwayat dengan `status: "failed"`.

#### `GET /admin/ai-summaries?page=&limit=`

Riwayat ringkasan (terbaru dulu), termasuk yang gagal.

#### `GET /admin/ai-summaries/latest`

Ringkasan berhasil terakhir. **404** jika belum pernah ada.

---

## 5. Kontrak layanan model (FastAPI) — internal backend ↔ AE

Base URL: `https://<ml-service>.onrender.com`. Dipanggil hanya oleh backend; dilindungi header `X-API-Key` (disimpan di env kedua layanan).

Format error mengikuti format 1.2 (`status`, `code`, `message`, `errors`) — handler 422 bawaan FastAPI di-*override* agar seragam.

Timeout dari backend: **10 detik** (Render free tier bisa *cold start* ±50 detik — panggil `/health` sebelum demo).

### `GET /health`
```json
{ "status": "ok", "models": { "sizeEstimator": "1.0.0", "demand": "1.0.0" } }
```

### `POST /v1/size-estimate`

Berbasis aturan tabel ukuran owner, bukan model terlatih.

**Request**
```json
{ "ld": 88, "tb": 158, "bb": 52 }
```

**200**
```json
{ "size": "M", "inRange": true, "message": "Perkiraan ukuran M berdasarkan tabel ukuran" }
```
Di luar tabel:
```json
{ "size": null, "inRange": false, "message": "Ukuran di luar tabel, silakan hubungi admin untuk fitting" }
```
**400 VALIDATION_ERROR** jika nilai kosong/negatif/bukan angka.

### `POST /v1/predict/demand`

**Request**
```json
{ "targetMonth": "2027-04" }
```
> Fitur input lain (mis. jumlah event, musim wisuda) **ditentukan bersama Syahidah/Ilham** setelah dataset siap model (paling lambat 1 Des 2026). Bentuk request boleh bertambah, bentuk response di bawah dipertahankan.

**200**
```json
{
  "targetMonth": "2027-04",
  "model": { "name": "random_forest", "version": "1.0.0" },
  "dataSource": "campuran",
  "predictions": [ { "size": "M", "predictedCount": 12 } ]
}
```

---

## 6. Tabel database (ringkas)

| Tabel | Kolom utama |
|---|---|
| `admins` | id, username (unik), password_hash, created_at |
| `kebaya` | id, code (unik), name, category, size, photo_url, description, is_active, created_at, updated_at |
| `bookings` | id, kebaya_id (FK), customer_name, use_date, event_purpose, ld, tb, bb, estimated_size, status, needs_fitting, rental_start, rental_end, dp_amount, dp_paid_at, paid_off_at, handed_over_at, returned_at, admin_note, created_at, updated_at |
| `analytics_results` | id, data_source, payload (JSONB), generated_at |
| `ai_summaries` | id, status (`success`/`failed`), summary, provider, model, input (JSONB), error_code, created_at |

Index: `bookings (kebaya_id, rental_start, rental_end)` untuk cek tumpang tindih.

Tipe kolom: `use_date`, `rental_start`, dan `rental_end` bertipe `date` (tanpa jam dan zona waktu) supaya hitungan H-1/H+1 dan jeda laundry tidak bergeser karena selisih UTC dan WIB. Kolom waktu (`*_at`) bertipe `timestamptz`.

---

## 7. Variabel lingkungan backend

| Nama | Contoh |
|---|---|
| `DATABASE_URL` | `postgres://...` (Neon) |
| `JWT_SECRET` | — |
| `CORS_ORIGIN` | `https://<frontend>.netlify.app` |
| `ML_SERVICE_URL`, `ML_API_KEY` | — |
| `GEMINI_API_KEY` | — |
| `RENTAL_DAYS_BEFORE` / `RENTAL_DAYS_AFTER` / `LAUNDRY_DAYS` | `1` / `1` / `2` |
| `ML_TIMEOUT_MS` / `AI_TIMEOUT_MS` | `10000` / `20000` |

Tidak ada API key di kode atau repositori.

---

## 8. Pertanyaan terbuka (perlu disepakati)

1. **Kontak customer** — form di plan tidak meminta nomor WhatsApp. Bagaimana admin menghubungi customer untuk fitting/DP? Usul: tambah `contact` opsional (data contoh saja saat demo).
2. **Tabel ukuran owner** — daftar ukuran (`S`–`XXL`?) dan rentang LD/TB/BB per ukuran.
3. **Masa sewa & jeda laundry** — konfirmasi H-1 s.d. H+1 dan jeda 2 hari.
4. **Satuan prediksi** — prediksi per ukuran, per kategori, atau per kebaya?
5. **Format output analisis DS** — JSON sesuai `GET /admin/analytics` di atas, atau perlu dihitung langsung dari tabel `bookings`?
6. **Foto kebaya** — cukup URL (MVP) atau perlu unggah file?

## Riwayat perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 0.1 | 2026-11-24 | Draft awal dari Project Plan |
| 0.2 | 2026-11-24 | "Hari ini" dihitung di Asia/Jakarta dan kolom tanggal bertipe `date`; batas percobaan login (`429 TOO_MANY_ATTEMPTS`); format error diseragamkan (`data` opsional, `conflictWith` pindah ke `data`, `AI_QUOTA_EXCEEDED` jadi 503) |
