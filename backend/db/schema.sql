-- Skema database Sewa Kebaya By Ariegunarti (A26-CS010)
-- Target: PostgreSQL (Neon). Sumber aturan: docs/api-contract.md v0.4 (bagian 2, 4, 5, dan 6).
-- Jalankan: psql "$DATABASE_URL" -f backend/db/schema.sql
-- Enum memakai text + CHECK (bukan CREATE TYPE) supaya mudah diubah saat tabel ukuran owner final.

BEGIN;

-- Dibutuhkan untuk EXCLUDE dengan kolom integer (kebaya_id) di index GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- updated_at diisi database, backend tidak perlu ingat.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Akun admin dibuat lewat seed, tidak ada endpoint registrasi.
CREATE TABLE admins (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      varchar(50)  NOT NULL UNIQUE,
  password_hash text         NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE kebaya (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        varchar(20)  NOT NULL UNIQUE,                -- bentrok -> 409 DUPLICATE_CODE (SQLSTATE 23505)
  name        varchar(100) NOT NULL,
  category    text         NOT NULL CHECK (category IN ('kebaya', 'kemeja_couple')),
  size        text         NOT NULL CHECK (size IN ('S', 'M', 'L', 'XL', 'XXL', 'ALL_SIZE')),
  photo_url   text         NOT NULL,
  description varchar(500),
  is_active   boolean      NOT NULL DEFAULT true,          -- tidak ada DELETE, hanya nonaktif
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TRIGGER kebaya_updated_at BEFORE UPDATE ON kebaya
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bookings (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kebaya_id      integer      NOT NULL REFERENCES kebaya (id),  -- tanpa CASCADE: riwayat harus utuh
  customer_name  varchar(100) NOT NULL CHECK (btrim(customer_name) <> ''),
  customer_contact varchar(50),                            -- opsional (WhatsApp/Instagram); saat demo hanya data contoh
  use_date       date         NOT NULL,
  event_purpose  text         NOT NULL
                 CHECK (event_purpose IN ('wisuda', 'kartini', 'pernikahan', 'lamaran', 'lainnya')),
  ld             numeric(4,1) NOT NULL CHECK (ld BETWEEN 60 AND 150),
  tb             numeric(4,1) NOT NULL CHECK (tb BETWEEN 130 AND 200),
  bb             numeric(4,1) NOT NULL CHECK (bb BETWEEN 30 AND 150),
  estimated_size text         CHECK (estimated_size IN ('S', 'M', 'L', 'XL', 'XXL', 'ALL_SIZE')),  -- null jika model gagal atau di luar tabel ukuran
  size_table_version varchar(30),                          -- tableVersion dari layanan model, mis. 'sementara-1'; null jika model gagal
  status         text         NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'rejected', 'dp_paid', 'paid_off', 'handed_over', 'returned', 'cancelled')),
  needs_fitting  boolean,                                   -- null = belum diputuskan admin
  -- Disimpan saat pengajuan dibuat, supaya ganti env RENTAL_DAYS_*/LAUNDRY_DAYS tidak menggeser pengajuan lama.
  rental_start   date         NOT NULL,
  rental_end     date         NOT NULL,
  dp_amount      integer      CHECK (dp_amount > 0),        -- rupiah, tanpa desimal
  dp_paid_at     timestamptz,
  paid_off_at    timestamptz,
  handed_over_at timestamptz,
  returned_at    timestamptz,
  admin_note     text,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),

  CHECK (rental_start <= use_date AND use_date <= rental_end),
  -- Perkiraan ukuran selalu dicatat bersama versi tabel ukuran yang menghitungnya (kontrak 5).
  -- Di luar tabel: estimated_size null, size_table_version tetap terisi.
  CONSTRAINT bookings_size_has_table_version CHECK (estimated_size IS NULL OR size_table_version IS NOT NULL),
  -- Setiap status setelah DP wajib punya data DP; tiap tahap wajib punya waktunya.
  CHECK (status IN ('pending', 'rejected') OR (dp_amount IS NOT NULL AND dp_paid_at IS NOT NULL)),
  CHECK (status NOT IN ('paid_off', 'handed_over', 'returned') OR paid_off_at IS NOT NULL),
  CHECK (status NOT IN ('handed_over', 'returned') OR handed_over_at IS NOT NULL),
  CHECK (status <> 'returned' OR returned_at IS NOT NULL),

  -- Pengaman terakhir anti double booking (kontrak 2.4): dua pengajuan berstatus pemblokir
  -- pada kebaya yang sama tidak boleh punya masa sewa tumpang tindih. Tetap pakai row lock
  -- di transaksi DP untuk mengisi data.conflictWith; pelanggaran ini (SQLSTATE 23P01)
  -- dipetakan ke 409 KEBAYA_NOT_AVAILABLE.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    kebaya_id WITH =,
    daterange(rental_start, rental_end, '[]') WITH &&
  ) WHERE (status IN ('dp_paid', 'paid_off', 'handed_over', 'returned'))
);

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cek ketersediaan dan deteksi pengajuan ganda (pending) per kebaya.
CREATE INDEX bookings_kebaya_period_idx ON bookings (kebaya_id, rental_start, rental_end);
-- Daftar admin: filter status + urut/filter use_date.
CREATE INDEX bookings_status_use_date_idx ON bookings (status, use_date);

-- Hasil analisis DS, di-seed dari output notebook. payload berbentuk data GET /admin/analytics.
CREATE TABLE analytics_results (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data_source  text        NOT NULL CHECK (data_source IN ('asli', 'contoh', 'campuran')),
  payload      jsonb       NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),

  -- Aturan Asah (kontrak 4): rekomendasi bisnis hanya boleh disusun dari data asli.
  CONSTRAINT analytics_recommendations_only_asli
    CHECK (data_source = 'asli' OR COALESCE(payload -> 'recommendations', '[]'::jsonb) = '[]'::jsonb)
);

-- Riwayat ringkasan AI, termasuk percobaan gagal.
CREATE TABLE ai_summaries (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status     text        NOT NULL CHECK (status IN ('success', 'failed')),
  summary    text,
  provider   varchar(30) NOT NULL,
  model      varchar(60) NOT NULL,
  input      jsonb       NOT NULL,                          -- { targetMonth }
  error_code text        CHECK (error_code IN ('AI_UNAVAILABLE', 'AI_QUOTA_EXCEEDED', 'AI_TIMEOUT')),
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK ((status = 'success' AND summary IS NOT NULL AND error_code IS NULL)
      OR (status = 'failed'  AND summary IS NULL     AND error_code IS NOT NULL))
);

-- GET /admin/ai-summaries/latest dan riwayat terbaru dulu.
CREATE INDEX ai_summaries_status_created_idx ON ai_summaries (status, created_at DESC);

COMMIT;
