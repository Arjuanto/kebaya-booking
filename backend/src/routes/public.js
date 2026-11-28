const express = require('express');
const Joi = require('joi');
const db = require('../db');
const { AppError, checkId, isDate, validate } = require('../errors');
const { estimateSize, mlHealthy } = require('../ml');
const { CATEGORIES, KEBAYA_COLUMNS, toKebaya } = require('./admin-kebaya');
const { BLOCKING } = require('./admin-bookings');

// Kontrak 1: "hari ini" di Asia/Jakarta, bukan jam server (Render memakai UTC). WIB = UTC+7 sepanjang tahun.
const todayJakarta = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Kontrak 2.4 dan 7: jumlah hari dari env, dibaca setiap kali dipakai. Nilai yang bukan bilangan bulat >= 0
// jadi 500 (tercatat di log), supaya salah konfigurasi tidak diam-diam menggeser masa sewa.
function envDays(name, fallback) {
  const days = Number(process.env[name] || fallback);
  if (!Number.isInteger(days) || days < 0) throw new Error(`${name} harus bilangan bulat >= 0`);
  return days;
}
const rentalPeriod = (useDate) => ({
  start: addDays(useDate, -envDays('RENTAL_DAYS_BEFORE', 1)),
  end: addDays(useDate, envDays('RENTAL_DAYS_AFTER', 1) + envDays('LAUNDRY_DAYS', 2)),
});

// Kontrak 1.2 dan 2.2: satu pesan untuk bukan angka dan di luar rentang,
// mis. "Lingkar dada harus angka antara 60 dan 150".
function measure(label, min, max) {
  const message = `{#label} harus angka antara ${min} dan ${max}`;
  return Joi.number()
    .min(min)
    .max(max)
    .empty('')
    .required()
    .label(label)
    .messages({ 'number.base': message, 'number.min': message, 'number.max': message, 'number.unsafe': message });
}

// Tanggal pemakaian dan ukuran badan (kontrak 2.2), dipakai cek ketersediaan dan kirim pengajuan.
const searchFields = {
  // Format dan "paling cepat besok" dicek dalam satu aturan, supaya tanggal tidak valid tidak dapat dua pesan.
  useDate: Joi.string()
    .custom((v, h) => (!isDate(v) ? h.error('date.base') : v > todayJakarta() ? v : h.error('date.future')))
    .required()
    .label('Tanggal pemakaian')
    .messages({ 'date.future': '{#label} paling cepat besok' }),
  ld: measure('Lingkar dada', 60, 150),
  tb: measure('Tinggi badan', 130, 200),
  bb: measure('Berat badan', 30, 150),
};

const availableSchema = Joi.object({
  ...searchFields,
  category: Joi.string()
    .valid(...CATEGORIES)
    .empty('')
    .label('Kategori'),
});

const bookingSchema = Joi.object({
  customerName: Joi.string().trim().min(2).max(100).required().label('Nama'),
  customerContact: Joi.string().trim().max(50).allow(null).empty('').default(null).label('Kontak'),
  eventPurpose: Joi.string()
    .valid('wisuda', 'kartini', 'pernikahan', 'lamaran', 'lainnya')
    .required()
    .label('Keperluan acara'),
  ...searchFields,
  kebayaId: Joi.number().integer().min(1).max(2147483647).required().label('ID kebaya'),
});

// Kontrak 3: isi sizeEstimate saat layanan model gagal atau timeout.
const NO_ESTIMATE = {
  available: false,
  size: null,
  inRange: null,
  message: 'Perkiraan ukuran sedang tidak tersedia, silakan hubungi admin untuk fitting',
};

// Kontrak 2.4: kebaya k sedang dipakai pengajuan berstatus pemblokir ($1) yang masa sewanya tumpang tindih dengan
// masa sewa [$2, $3] (startA <= endB AND startB <= endA).
const TAKEN = `EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.kebaya_id = k.id AND b.status = ANY($1) AND b.rental_start <= $3 AND $2 <= b.rental_end)`;

const notFound = () => new AppError(404, 'NOT_FOUND', 'Kebaya tidak ditemukan');
const notAvailable = (message) => new AppError(409, 'KEBAYA_NOT_AVAILABLE', message);

// Endpoint customer (kontrak 3), dipasang di /api/v1 tanpa token.
function publicRoutes() {
  const router = express.Router();

  router.param('id', checkId(notFound));

  router.get('/health', async (req, res) => {
    const [dbUp, mlUp] = await Promise.all([
      db.query('SELECT 1').then(
        () => true,
        (err) => {
          console.error('Database tidak bisa dihubungi', err);
          return false;
        },
      ),
      mlHealthy(),
    ]);
    res.json({ status: 'success', data: { db: dbUp ? 'ok' : 'down', mlService: mlUp ? 'ok' : 'down' } });
  });

  router.get('/kebaya/available', async (req, res) => {
    const { useDate, ld, tb, bb, category = null } = validate(availableSchema, req.query);
    const period = rentalPeriod(useDate);
    // Ketersediaan tidak bergantung pada layanan model (kontrak 3), jadi keduanya jalan bersamaan.
    const [{ rows }, estimate] = await Promise.all([
      db.query(
        `SELECT ${KEBAYA_COLUMNS} FROM kebaya k
         WHERE k.is_active AND ($4::text IS NULL OR k.category = $4) AND NOT ${TAKEN}
         ORDER BY k.code`,
        [BLOCKING, period.start, period.end, category],
      ),
      estimateSize({ ld, tb, bb }),
    ]);
    const sizeEstimate = estimate
      ? { available: true, size: estimate.size, inRange: estimate.inRange, message: estimate.message }
      : NO_ESTIMATE;
    const kebaya = rows.map((r) => {
      const { id, code, name, category, size, photoUrl } = toKebaya(r);
      // ALL_SIZE cocok untuk ukuran apa pun; null jika tidak ada perkiraan ukuran (model gagal atau di luar tabel).
      const sizeMatch = sizeEstimate.size === null ? null : size === sizeEstimate.size || size === 'ALL_SIZE';
      return { id, code, name, category, size, photoUrl, sizeMatch };
    });
    kebaya.sort((a, b) => (b.sizeMatch === true) - (a.sizeMatch === true)); // stabil: tetap urut kode di tiap kelompok
    res.json({
      status: 'success',
      message: `Ditemukan ${kebaya.length} kebaya tersedia`,
      data: { useDate, rentalPeriod: period, sizeEstimate, kebaya },
    });
  });

  router.get('/kebaya/:id', async (req, res) => {
    const { rows } = await db.query(`SELECT ${KEBAYA_COLUMNS} FROM kebaya WHERE id = $1 AND is_active`, [
      req.params.id,
    ]);
    if (!rows[0]) throw notFound();
    res.json({ status: 'success', data: toKebaya(rows[0]) });
  });

  router.post('/bookings', async (req, res) => {
    const b = validate(bookingSchema, req.body ?? {});
    const period = rentalPeriod(b.useDate);
    // Dicek ulang di sini karena pengajuan bisa dikirim langsung lewat API, tanpa daftar ketersediaan.
    // Constraint bookings_no_overlap tidak berlaku untuk status pending, jadi INSERT di bawah tidak bisa 23P01.
    const { rows: [k] } = await db.query(
      `SELECT k.id, k.code, k.name, k.is_active, ${TAKEN} AS taken FROM kebaya k WHERE k.id = $4`,
      [BLOCKING, period.start, period.end, b.kebayaId],
    );
    if (!k) throw notFound();
    if (!k.is_active) throw notAvailable(`Kebaya ${k.code} sedang tidak tersedia. Silakan pilih kebaya lain.`);
    if (k.taken) {
      throw notAvailable(
        `Kebaya ${k.code} sudah dipesan pada tanggal tersebut. Silakan pilih kebaya atau tanggal lain.`,
      );
    }

    // Model gagal -> estimatedSize dan sizeTableVersion null; pengajuan tetap tersimpan (kontrak 3).
    const estimate = await estimateSize(b);
    const { rows: [saved] } = await db.query(
      `INSERT INTO bookings (kebaya_id, customer_name, customer_contact, use_date, event_purpose, ld, tb, bb,
         estimated_size, size_table_version, rental_start, rental_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, status`,
      [
        k.id,
        b.customerName,
        b.customerContact,
        b.useDate,
        b.eventPurpose,
        b.ld,
        b.tb,
        b.bb,
        estimate?.size ?? null,
        estimate?.tableVersion ?? null,
        period.start,
        period.end,
      ],
    );
    res.status(201).json({
      status: 'success',
      message: 'Pengajuan berhasil dikirim. Admin akan meninjau pengajuan Anda.',
      data: {
        id: saved.id,
        status: saved.status,
        useDate: b.useDate,
        rentalPeriod: period,
        kebaya: { id: k.id, code: k.code, name: k.name },
        estimatedSize: estimate?.size ?? null,
      },
    });
  });

  return router;
}

module.exports = { publicRoutes };
