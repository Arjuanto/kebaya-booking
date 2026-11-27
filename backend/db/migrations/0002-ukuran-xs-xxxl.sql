-- Migrasi 0002: ukuran XS dan XXXL (kontrak v0.5, bagian 2.1 dan 8 no. 7).
-- Tabel ukuran tim punya XS dan XXXL. Tanpa migrasi ini, kebaya XS/XXXL tidak bisa dicatat dan perkiraan
-- ukuran XS/XXXL tidak bisa disimpan di bookings.estimated_size. Isi tabel tidak berubah.
--
-- Jalankan sekali setelah 0001, sebelum deploy backend v0.5:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/db/migrations/0002-ukuran-xs-xxxl.sql

BEGIN;

ALTER TABLE kebaya
  DROP CONSTRAINT kebaya_size_check,
  ADD CONSTRAINT kebaya_size_check CHECK (size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'ALL_SIZE'));

ALTER TABLE bookings
  DROP CONSTRAINT bookings_estimated_size_check,
  ADD CONSTRAINT bookings_estimated_size_check
    CHECK (estimated_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'ALL_SIZE'));

COMMIT;
