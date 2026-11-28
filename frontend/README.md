# Kerangka Frontend — Sewa Kebaya By Ariegunarti (A26-CS010)

Kerangka website resmi berbasis **React + Vite + Tailwind CSS + Axios** sesuai pemenuhan **Issue #24**.

## 1. Teknologi & Dependensi
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS (tema resmi palette UMKM *Sewa Kebaya By Ariegunarti*)
- **Routing:** React Router DOM v6
- **HTTP Client:** Axios (dikonfigurasi dengan Base URL & interceptor JWT)
- **Ikon:** Lucide React

## 2. Struktur Direktori
```
frontend/
├── .env                  # Variabel lingkungan lokal
├── .env.example          # Contoh variabel lingkungan
├── index.html            # Entry point HTML
├── package.json          # Dependensi & scripts
├── tailwind.config.js    # Konfigurasi palette & tipografi
├── vite.config.js        # Konfigurasi Vite
└── src/
    ├── App.jsx           # Rute utama (Customer & Admin)
    ├── main.jsx          # Mount React ke DOM
    ├── index.css         # Styling Tailwind & global
    ├── components/
    │   ├── Navbar.jsx    # Navigasi bersama (Customer/Admin)
    │   └── Footer.jsx    # Footer resmi
    ├── pages/
    │   ├── customer/     # Halaman Pelanggan (David)
    │   │   ├── HomePage.jsx
    │   │   └── CatalogPage.jsx
    │   ├── admin/        # Halaman Admin (Diva)
    │   │   ├── LoginPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   └── KebayaAdminPage.jsx (Mendukung upload foto Base64 v0.5)
    │   └── NotFoundPage.jsx
    └── services/
        └── api.js        # Instance Axios dengan VITE_API_BASE_URL
```

## 3. Menjalankan di Lokal

### A. Instalasi Dependensi
```bash
cd frontend
npm install
```

### B. Menjalankan Server Pengembangan
```bash
npm run dev
```
Aplikasi akan berjalan di `http://localhost:3000`.

### C. Build untuk Produksi (Netlify)
```bash
npm run build
```
Output tersimpan di folder `frontend/dist/`.
