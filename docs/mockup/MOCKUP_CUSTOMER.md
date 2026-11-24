# Mockup & Alur Halaman Portal Customer
**Proyek:** Sistem Booking Sewa Kebaya By Ariegunarti (Capstone A26-CS010)  
**Penanggung Jawab:** David Balbo (AI Full-Stack Developer)  
**Referensi Tugas:** Issue #5 / #15 — Mockup Halaman Customer  
**Sumber Desain Tim:** Figma Embed Official (`Sewa Kebaya (Copy)` / Node `0:1` *Dekstop & Mobile*)

---

## 1. Identitas Visual & Palette Warna (Sesuai Desain Figma Tim)
Berdasarkan file Figma resmi dari tim UI/UX dan identitas otentik UMKM *Sewa Kebaya By Ariegunarti*:
- **Latar Belakang (Silk Texture / Champagne Cream):** `#FAF7F2` – `#ECE0D1` (kain sutra satin champagne mewah dengan aksen gradasi lembut).
- **Warna Aksen Tombol Utama:** Gradien taupe `#BAA591` ke `#A48D77` dan `#23201D` (dark charcoal).
- **Tipografi:**
  - *Serif*: **Cormorant Garamond** & **Playfair Display** untuk judul besar, monogram AG, dan aksen kemewahan kebaya.
  - *Sans*: **Plus Jakarta Sans** untuk teks isi, formulir, label tombol, dan keterbacaan tinggi di desktop maupun mobile.
- **Logo Resmi:** Menggunakan asset logo asli monokrom elegan **AG BY ARIE GUNARTI** (`assets/logo-ag.jpg`).
- **Footer Resmi:** `BY_ARIEGUNARTI · CUSTOMER`.

---

## 2. Analisis Arsitektur: Apakah Customer Perlu Login?
Pertanyaan arsitektural: *Apakah customer perlu login seperti admin?*
**Jawabannya: TIDAK PERLU login dengan akun & password.**

Berikut pertimbangan teknis dan bisnis (*UX & Business Rationale*):
1. **Zero-Friction Booking (Mencegah Drop-off Pelanggan):**
   - Calon penyewa kebaya biasanya datang langsung dari tautan media sosial (Instagram Bio, TikTok, atau status WhatsApp).
   - Memaksa customer untuk mendaftar akun, mengingat password, dan verifikasi email akan menciptakan friksi besar (*high bounce rate*), sehingga pelanggan malas dan beralih ke penyewaan lain.
2. **Model Guest Booking Berbasis Nomor WhatsApp:**
   - Di sektor UMKM busana/sewa, **Nomor WhatsApp** adalah *primary identifier* yang paling valid dan akurat di Indonesia.
   - Saat mengisi form penyewaan (Data Diri + Ukuran Badan + Jadwal), nomor WhatsApp pelanggan otomatis menjadi identitas pemesan.
3. **Mekanisme Pelacakan Status Pesanan Tanpa Login:**
   - **Kode Pengajuan Unik (Booking Reference):** Setiap pengajuan sewa menghasilkan kode unik (misal: `AG-0261`).
   - **Pelacakan Cepat:** Pada tab *Pengajuan Saya*, customer cukup memasukkan nomor WhatsApp atau kode booking untuk melihat status tanpa perlu memasukkan password.
   - **Direct WhatsApp Notification:** Admin mengirim link pelacak pesanan langsung ke WhatsApp customer begitu status berubah (Fitting / Disetujui / DP).
4. **Perbedaan dengan Akun Admin:**
   - **Admin:** **WAJIB LOGIN** dengan autentikasi ketat (Role-Based Access Control / RBAC) karena memiliki akses ke database keuangan, verifikasi DP, kalender kebaya seluruh customer, dan manajemen inventaris.
   - **Customer:** Cukup bertindak sebagai *Guest User* dengan akses terbatas ke kode pesanannya sendiri.

---

## 2. Struktur Layar Sesuai Frame Figma Tim

Mockup customer mencakup seluruh perjalanan pengguna (*End-to-End Customer Journey*) sesuai frame Figma tim:

### A. Customer · Beranda (Figma `2002:2` & `2002:26`)
1. **Header Customer:**
   - Monogram logo AG & teks identitas `CUSTOMER By Arie Gunarti`.
   - Navigasi tab: **Beranda**, **Katalog**, dan **Pengajuan saya**.
   - Identitas customer: `Siti Rahmawati`.
2. **Banner Sambutan:**
   - Slogan: *"Kebaya pilihan untuk momen istimewamu."*
   - Subtitle: *"Temukan koleksi favorit, ajukan sewa, dan siapkan penampilan terbaikmu."*
   - Tombol aksi: `Jelajahi katalog →`.
3. **Pilihan Untukmu:**
   - Rekomendasi busana utama:
     - **Kebaya Ayu Ivory (`KBY-001`)** · Ivory · Ukuran M · Rp750.000 / sewa.
     - **Kebaya Laras Sage (`KBY-002`)** · Sage · Ukuran S · Rp650.000 / sewa.
4. **Banner Status Pengajuan Terbaru:**
   - Menampilkan ringkasan pesanan aktif (contoh: `AG-0261` - Menunggu konfirmasi admin) dengan tombol `Pantau pengajuan →`.

### B. Customer · Katalog (Figma `2002:6` & `2002:30`)
1. **Pencarian & Filter:**
   - Kolom pencarian: *"Cari nama atau kode kebaya…"*
   - Tanggal pemakaian: Kalender filter ketersediaan.
   - Filter ukuran: *Ukuran · Semua (S, M, L, XL)*.
   - Kategori filter pills: *Semua koleksi, Wisuda, Lamaran, Pernikahan*.
2. **Katalog Grid:**
   - **Kebaya Ayu Ivory (`KBY-001`)** · Ivory · M · Rp750.000.
   - **Kebaya Laras Sage (`KBY-002`)** · Sage · S · Rp650.000.
   - **Kebaya Kirana Rose (`KBY-003`)** · Dusty rose · M · Rp850.000.
3. **Aksi:** Tombol `Lihat detail →` dan `Ajukan sewa`.

### C. Customer · Detail Kebaya (Figma `2002:10` & `2002:34`)
1. **Breadcrumb:** `Katalog / Kebaya Ayu Ivory`.
2. **Pratinjau Busana:** Foto real pict kebaya & badge ketersediaan.
3. **Spesifikasi & Ukuran Fisik:**
   - Kode & Nama: `KBY-001 · KOLEKSI WISUDA`.
   - Ukuran: `Ukuran M` (Lingkar dada 90 cm · Tinggi referensi 160 cm).
   - Biaya sewa: `Rp750.000 / sewa`.
4. **Cek Tanggal Pemakaian:** Kalender cek tanggal acara + catatan edukasi customer bahwa pengajuan sewa belum mengunci kebaya sebelum diverifikasi admin.
5. **Tombol Aksi:** `Ajukan sewa →`.

### D. Customer · Ajukan Sewa (Figma `2002:14` & `2002:38`)
1. **01 · Data Pelanggan:**
   - Nama lengkap: `Siti Rahmawati`
   - WhatsApp: `0812 3456 7890`
   - Parameter fisik: Lingkar dada (`LD`), Tinggi badan (`TB`), Berat badan (`BB`).
2. **02 · Jadwal Penyewaan (H-1 s.d H+1):**
   - Tanggal ambil (H-1): Otomatis dihitung H-1 dari tanggal pakai.
   - Tanggal pakai (H): Tanggal hari H acara.
   - Tanggal kembali (H+1): Otomatis dihitung H+1 dari tanggal pakai.
   - Keperluan: Dropdown (Wisuda, Lamaran, Pernikahan, Foto Studio, dll.).
   - Catatan untuk admin.
3. **Ringkasan Pengajuan (Sidebar / Summary Box):**
   - Rincian kebaya & ukuran terpilih.
   - Total sewa: `Rp750.000`.
   - Rencana DP 50%: `Rp375.000`.
   - Ketentuan: *Pembayaran dilakukan setelah pengajuan disetujui admin. Pengajuan belum mengunci kebaya.*
   - Tombol Aksi: `Kirim pengajuan →`.

### E. Customer · Pengajuan Saya (Figma `2002:18` & `2002:44`)
1. **Dinamika State Pengajuan:**
   - **Kondisi Default (Pelanggan Baru / Belum Pesan):** Menampilkan *Empty State* ramah bertuliskan *"Belum Ada Pengajuan Sewa"*, ajakan melihat katalog, dan counter `Aktif · 0` tanpa dot oranye.
   - **Kondisi Setelah Mengirim Formulir:** Otomatis menghasilkan nomor pesanan baru, counter `Aktif · 1`, menyalakan dot notifikasi pada navigasi, dan merender kartu pesanan aktif.
   - **Opsi Demo / Lacak Manual:** Tersedia tombol simulasi demo pesanan serta kolom input pelacakan instan via Nomor WhatsApp atau Kode Booking.
2. **Kartu Pengajuan Aktif:**
   - Nomor pengajuan: `AG-xxxx` / `AG-0261`.
   - Status badge: `Menunggu admin`.
   - Rincian: Nama kebaya, ukuran, keperluan acara, dan rentang tanggal jadwal sewa.
   - Total sewa & tombol `Lihat detail →`.
3. **Kartu Panduan:** *"Apa selanjutnya?"* (3 langkah alur konfirmasi, fitting, dan pembayaran DP).

### F. Customer · Detail Pengajuan / Tracking Timeline (Figma `2002:22`)
1. **Header:** `Detail pengajuan` | `AG-0261` · Diajukan 23 Nov 2026.
2. **Stepper Timeline (Perjalanan Sewamu):**
   - `01 · Tinjau pengajuan` (Sedang ditinjau admin - Status: Aktif)
   - `02 · Fitting` (Menunggu tahap sebelumnya)
   - `03 · Pembayaran DP` (Menunggu tahap sebelumnya)
   - `04 · Pelunasan` (Menunggu tahap sebelumnya)
   - `05 · Pengambilan` (Menunggu tahap sebelumnya)
   - `06 · Pengembalian` (Menunggu tahap sebelumnya)
3. **Ringkasan Sewa & Hubungi Admin:**
   - Detail sewa dan tanggal jadwal.
   - Status pembayaran: `DP belum dibayar`.
   - Tombol: `Hubungi admin` (Direct WhatsApp link).

---

## 3. Cara Menjalankan & Menguji Mockup Interaktif

File prototipe interaktif tersedia dalam format standalone HTML/Tailwind CSS:
- Buka file [index.html](file:///c:/laragon/www/kebaya-booking/docs/mockup/index.html) di browser (Chrome, Edge, Firefox, atau Safari).
- Gunakan switcher di pojok kanan atas:
  - **Desktop:** Menampilkan simulasi tampilan layar penuh laptop/PC (1200px) sesuai frame Desktop di Figma tim.
  - **Ponsel:** Menampilkan simulasi smartphone (430px) sesuai frame Mobile di Figma tim.
- Semua navigasi tab (Beranda, Katalog, Detail Kebaya, Ajukan Sewa, Pengajuan Saya, Detail Pengajuan) berfungsi secara interaktif.
