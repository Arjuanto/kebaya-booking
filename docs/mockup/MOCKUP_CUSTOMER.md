# Dokumentasi Mockup Halaman Customer — Sewa Kebaya By Ariegunarti
**Proyek:** Sistem Booking Sewa Kebaya By Ariegunarti (Capstone A26-CS010)  
**Penanggung Jawab:** David Balbo (`@superrbalbo`, AI Full-Stack Developer)  
**Referensi Desain:** Figma Resmi Tim (`Sewa-Kebaya` / Node `0:1`) & Pemenuhan Issue #5 / #15 / #23 / #26  

---

## 1. Alur Lengkap Customer (End-to-End Customer Journey)

Berdasarkan rancangan desain Figma tim dan kelengkapan siklus penyewaan, mockup interaktif pada [docs/mockup/index.html](file:///c:/laragon/www/kebaya-booking/docs/mockup/index.html) mencakup seluruh tahapan secara terintegrasi:

```
[1. Katalog Kebaya] 
   - Pencarian, filter tanggal & ukuran, filter kategori (Wisuda, Lamaran, Pernikahan)
   - Kartu busana real pict dengan harga & status ketersediaan
            │
            ▼
[2. Detail Kebaya]
   - Foto besar mannequin, spesifikasi fisik (LD & tinggi referensi)
   - Cek tanggal pemakaian & disclaimer pengajuan sewa
            │
            ▼
[3. Ajukan Sewa]
   - Form 01: Data pelanggan (Nama, WhatsApp, LD, TB, BB)
   - Form 02: Jadwal sewa (Ambil H-1, Pakai H, Kembali H+1, Keperluan)
   - Ringkasan total sewa & rencana DP 50%
            │
            ▼
[4. Konfirmasi Berhasil Dikirim (Modal Popup)]
   - Status: Pengajuan Terkirim (Kode Unik #AG-0261)
   - Keterangan bahwa pengajuan berhasil masuk ke sistem antrean admin
            │
            ▼
[5. Pengajuan Saya]
   - Tab Aktif & Riwayat
   - Kartu pesanan aktif dengan status badge (Menunggu Admin)
   - Rincian sewa, harga, dan panduan langkah selanjutnya ("Apa selanjutnya?")
            │
            ▼
[6. Detail Pengajuan & Timeline Tracking 6 Langkah]
   - Stepper: 01 Tinjau pengajuan ➔ 02 Fitting ➔ 03 Pembayaran DP ➔ 04 Pelunasan ➔ 05 Pengambilan ➔ 06 Pengembalian
   - Status Card dinamis & tombol langsung "Hubungi admin" via WhatsApp
```

---

## 2. Fitur Unggulan Prototipe

1. **Simulasi Status Siklus Sewa (Top Bar):**
   - Di bagian atas layar terdapat dropdown **Status Demo** yang memungkinkan reviewer atau tim untuk mengubah status pesanan secara *live*:
     - `01. Menunggu Admin` (Pengajuan baru masuk antrean)
     - `02. Disetujui & Fitting` (Admin mengonfirmasi ketersediaan & jadwal fitting di butik)
     - `03. DP Tercatat (Terkunci)` (Down payment 50% lunas, busana terkunci anti double-booking)
     - `04. Busana Diambil` (Status diserahkan ke penyewa pada H-1)
     - `05. Selesai Dikembalikan` (Penyewaan tuntas & busana diterima kembali)
   - Setiap pergantian status akan otomatis memperbarui warna badge, teks instruksi, dan progres *stepper* timeline.

2. **Responsif Desktop & Mobile:**
   - Tersedia tombol pengalih **Desktop (1120px)** dan **Ponsel (420px)** untuk menguji kenyamanan tampilan di smartphone.

---

## 3. Cara Menguji di Komputer Lokal

1. Buka file [docs/mockup/index.html](file:///c:/laragon/www/kebaya-booking/docs/mockup/index.html) langsung di Google Chrome / Edge / browser favorit Anda.
2. Coba klik kartu kebaya di katalog untuk melihat **Detail Kebaya**.
3. Klik tombol **Ajukan sewa →** untuk mengisi data pemesanan.
4. Klik **Kirim pengajuan →** dan amati modal popup konfirmasi berhasil yang muncul.
5. Klik **Lihat di Pengajuan Saya →** untuk melihat kartu pesanan dan melacak tahapan proses sewanya.
6. Coba ganti **Status Demo** di bilah atas untuk melihat perubahan status secara langsung!
