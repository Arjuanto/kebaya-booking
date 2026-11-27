-- Migrasi 0001: foto kebaya diunggah admin (kontrak v0.5).
-- Untuk database yang dibuat dari schema.sql v0.4: kolom photo_url (URL) diganti photo (isi file, bytea)
-- dan photo_type, sama dengan backend/db/schema.sql terbaru.
--
-- PERHATIAN: kalau tabel kebaya sudah berisi data, migrasi ini GAGAL (kolom NOT NULL baru tidak punya
-- nilai) dan dibatalkan utuh. Hapus dulu data contohnya (beserta bookings yang merujuknya), atau beri
-- foto lebih dulu: tambah kolom tanpa NOT NULL, isi fotonya, baru pasang NOT NULL.
--
-- Jalankan sekali sebelum deploy backend v0.5:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/db/migrations/0001-foto-kebaya.sql

BEGIN;

ALTER TABLE kebaya
  DROP COLUMN photo_url,
  ADD COLUMN photo bytea NOT NULL,
  ADD COLUMN photo_type text NOT NULL CHECK (photo_type IN ('image/jpeg', 'image/png', 'image/webp'));

COMMIT;
