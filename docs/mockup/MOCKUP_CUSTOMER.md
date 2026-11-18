# Mockup & Alur Halaman Pemesanan Customer
**Proyek:** Sistem Booking Sewa Kebaya By Ariegunarti (Capstone A26-CS010)  
**Penanggung Jawab:** David Balbo (AI Full-Stack Developer)  
**Referensi Tugas:** Issue #5 / #15 — Mockup Halaman Customer  
**Tema Visual:** Identitas Resmi UMKM *Sewa Kebaya By Ariegunarti* (Canva / Bio Link Asli)

---

## 1. Identitas Visual & Palette Warna (Sesuai Aslinya)
Berdasarkan tautan dan katalog resmi UMKM (*rentkebayabyariegunarti.my.canva.site*), mockup ini mengadopsi tema visual otentik:
- **Latar Belakang (Silk Texture / Champagne Cream):** `#F8F3EB` – `#EBDDC8` (tekstur lembut kain sutra satin champagne dengan lipatan lembut).
- **Warna Aksen Tombol (Warm Taupe Pill):** Gradien `#BAA591` ke `#A48D77` berbentuk *pill-rounded* khas UMKM.
- **Tipografi:** Kombinasi *Playfair Display* (Serif mewah untuk judul & logo) dan *Plus Jakarta Sans* (Sans-serif bersih untuk formulir & keterbacaan di ponsel).
- **Logo Resmi:** Monogram **AG BY ARIE GUNARTI**.
- **Tagline Asli UMKM:**
  - *"pretty attire for graduation, engagement, prewedding and special occasion. Let's check our collection!"*
  - *"Timeless tradition in modern glamour exclusively rent by_ariegunarti"*

---

## 2. Struktur Komponen Layar (Customer Page)

### A. Header & Branding Otentik
- Monogram logo AG & ilustrasi kebaya khas UMKM.
- Tagline resmi dan indikator sistem booking otomatis aktif (*Anti Double-Booking*).

### B. Formulir Input Pemesan & Ukuran Badan
- **Nama Pemesan** (Wajib, teks)
- **Nomor WhatsApp / HP** (Wajib, nomor kontak untuk konfirmasi admin)
- **Tanggal Pemakaian** (Wajib, Date picker, divalidasi tidak boleh tanggal lampau)
- **Tujuan Acara** (Wajib, Dropdown: Wisuda, Lamaran, Pernikahan/Bridesmaid, Hari Kartini, Foto Studio, dll.)
- **Parameter Ukuran Badan**:
  - `LD` (Lingkar Dada dlm cm, min 60, max 140)
  - `TB` (Tinggi Badan dlm cm, min 100, max 210)
  - `BB` (Berat Badan dlm kg, min 30, max 150)
- **Tombol Aksi:** *"Cek Ketersediaan Kebaya & Ukuran"* (dengan styling pill taupe khas Canva UMKM).

### C. State Interaksi & Indikator Respons
- **State Memproses (Loading):** Menampilkan animasi loading saat sistem menghitung periode ketersediaan (H-1 s.d H+1 + jeda laundry) dan perkiraan ukuran.
- **State Error / Validasi:** Menolak input jika tanggal lampau, nama kosong, atau angka LD/TB/BB di luar batas fisik manusia dengan pesan kesalahan yang jelas dan manusiawi.

### D. Hasil Rekomendasi Ukuran (Rule-Based Tabel Owner)
| Rentang LD (Lingkar Dada) | Rekomendasi Ukuran | Status Fitting |
| :--- | :---: | :--- |
| $\le$ 86 cm | **S** | Tersedia Siap Pakai |
| 87 – 92 cm | **M** | Tersedia Siap Pakai |
| 93 – 98 cm | **L** | Tersedia Siap Pakai |
| 99 – 106 cm | **XL** | Tersedia Siap Pakai |
| 107 – 116 cm | **XXL** | Tersedia Siap Pakai |
| > 116 cm atau < 60 cm | **Custom** | Wajib Fitting / Hubungi Admin |

### E. Katalog Kebaya yang Tersedia
- Menampilkan kartu kebaya: Foto kebaya, Kode Kebaya (misal `KB-012`), Nama Kebaya, Ukuran asli, Keterangan kecocokan dengan ukuran customer, dan Harga sewa.
- Tombol **"Ajukan Sewa Kebaya Ini"**.

### F. Modal Konfirmasi & Pengiriman Pengajuan
- Ringkasan pesanan sebelum dikirim.
- Catatan edukasi customer: *Pengajuan masih berstatus menunggu dan kebaya baru resmi terkunci setelah DP disetujui admin.*

### G. State Berhasil (Success Confirmation)
- Menampilkan pesan sukses dengan **Kode Pengajuan** (contoh: `BK-20261119-089`).
- Status: **Menunggu Tinjauan Admin**.
- Penjelasan langkah berikutnya: Admin akan meninjau ketersediaan fisik, fitting, dan pencatatan DP.

---

## 3. Cara Menjalankan & Menguji Mockup Interaktif

File prototipe interaktif telah dibuat dalam format standalone HTML/Tailwind CSS:
- Buka file [index.html](file:///c:/laragon/www/kebaya-booking/docs/mockup/index.html) langsung di web browser (Chrome, Edge, Firefox, atau Safari).
- Di bagian atas terdapat toggle switcher:
  - **Ponsel / Mobile:** Menampilkan simulasi tampilan smartphone (responsif).
  - **Desktop:** Menampilkan simulasi tampilan layar penuh laptop/PC.
- Silakan coba isi formulir, klik tombol pencarian, pilih kebaya, dan kirim pengajuan untuk melihat seluruh alur state UI.
