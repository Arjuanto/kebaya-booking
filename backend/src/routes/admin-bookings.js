const express = require('express');
const Joi = require('joi');
const db = require('../db');
const { AppError, checkId, isDate, validate } = require('../errors');

// Kontrak 2.3: label status di UI dan transisi yang sah.
const LABEL = {
  pending: 'Menunggu',
  rejected: 'Ditolak',
  dp_paid: 'DP tercatat',
  paid_off: 'Lunas',
  handed_over: 'Diserahkan',
  returned: 'Dikembalikan',
  cancelled: 'Dibatalkan',
};
const STATUSES = Object.keys(LABEL);
const NEXT = {
  pending: ['dp_paid', 'rejected'],
  dp_paid: ['paid_off', 'cancelled'],
  paid_off: ['handed_over'],
  handed_over: ['returned'],
};
// Status pemblokir ketersediaan; sama dengan WHERE constraint bookings_no_overlap (kontrak 6).
const BLOCKING = ['dp_paid', 'paid_off', 'handed_over', 'returned'];
const MAX_INT = 2147483647;

const dateOnly = Joi.string().custom((v, h) => (isDate(v) ? v : h.error('date.base')));
// Tidak dikirim = catatan lama tetap; kosong atau null = catatan dihapus.
const adminNote = Joi.string().trim().max(500).allow(null, '').label('Catatan admin');

// Nilai kosong (mis. ?status=) berarti tanpa filter, sama seperti katalog.
const listSchema = Joi.object({
  status: Joi.string()
    .empty('')
    .custom((v, h) => {
      const list = v.split(',').map((s) => s.trim());
      return list.every((s) => STATUSES.includes(s)) ? list : h.error('any.only', { valids: STATUSES });
    })
    .label('Filter status'),
  kebayaId: Joi.number().integer().min(1).max(MAX_INT).empty('').label('Filter kebaya'),
  from: dateOnly.empty('').label('Tanggal awal'),
  to: dateOnly.empty('').label('Tanggal akhir'),
  hasDuplicate: Joi.boolean().empty('').label('Filter pengajuan ganda'),
  page: Joi.number().integer().min(1).max(MAX_INT).empty('').default(1).label('Halaman'),
  limit: Joi.number().integer().min(1).max(100).empty('').default(20).label('Jumlah per halaman'),
});

const fittingSchema = Joi.object({
  needsFitting: Joi.boolean().required().label('Perlu fitting'),
  adminNote,
});

// Kontrak 4: body tambahan tergantung status tujuan; field yang bukan untuk status itu diabaikan.
const statusSchema = Joi.object({
  status: Joi.string()
    .valid(...STATUSES)
    .required()
    .label('Status'),
  dpAmount: Joi.number()
    .integer()
    .positive()
    .max(MAX_INT)
    .when('status', { is: 'dp_paid', then: Joi.required() })
    .label('Jumlah DP'),
  paidAt: Joi.date().iso().label('Waktu bayar'),
  at: Joi.date().iso().label('Waktu'),
  adminNote,
});

const notFound = () => new AppError(404, 'NOT_FOUND', 'Pengajuan tidak ditemukan');

// Booking + kebaya + pengajuan ganda (kontrak 2.4): pengajuan pending lain pada kebaya yang sama dengan
// masa sewa tumpang tindih. Ganda hanya antar-pending, jadi pengajuan yang bukan pending selalu [].
const SELECT_BOOKING = `
  SELECT b.*, k.code AS kebaya_code, k.name AS kebaya_name, dup.ids AS duplicate_with
  FROM bookings b
  JOIN kebaya k ON k.id = b.kebaya_id
  CROSS JOIN LATERAL (
    SELECT ARRAY(
      SELECT o.id FROM bookings o
      WHERE b.status = 'pending' AND o.status = 'pending'
        AND o.kebaya_id = b.kebaya_id AND o.id <> b.id
        AND o.rental_start <= b.rental_end AND b.rental_start <= o.rental_end
      ORDER BY o.id
    ) AS ids
  ) dup`;

// Baris SELECT_BOOKING (snake_case) -> objek Booking kontrak 2.2 (camelCase).
const toBooking = (r) => ({
  id: r.id,
  customerName: r.customer_name,
  customerContact: r.customer_contact,
  useDate: r.use_date,
  eventPurpose: r.event_purpose,
  ld: Number(r.ld), // kolom numeric dikirim pg sebagai teks
  tb: Number(r.tb),
  bb: Number(r.bb),
  estimatedSize: r.estimated_size,
  sizeTableVersion: r.size_table_version,
  kebaya: { id: r.kebaya_id, code: r.kebaya_code, name: r.kebaya_name },
  status: r.status,
  needsFitting: r.needs_fitting,
  rentalPeriod: { start: r.rental_start, end: r.rental_end },
  dpAmount: r.dp_amount,
  dpPaidAt: r.dp_paid_at,
  paidOffAt: r.paid_off_at,
  handedOverAt: r.handed_over_at,
  returnedAt: r.returned_at,
  adminNote: r.admin_note,
  hasDuplicate: r.duplicate_with.length > 0,
  duplicateWith: r.duplicate_with,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function findBooking(id) {
  const { rows } = await db.query(`${SELECT_BOOKING} WHERE b.id = $1`, [id]);
  if (!rows[0]) throw notFound();
  return toBooking(rows[0]);
}

const period = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// 409 seperti contoh kontrak 4 ("KB-012 sudah terkonfirmasi DP untuk pengajuan #44 pada 19–23 Des 2026..."),
// atau null jika masa sewa booking b tidak bentrok dengan pengajuan berstatus pemblokir.
async function conflictError(client, b) {
  const { rows } = await client.query(
    `SELECT o.id, o.rental_start, o.rental_end, k.code
     FROM bookings o JOIN kebaya k ON k.id = o.kebaya_id
     WHERE o.kebaya_id = $1 AND o.id <> $2 AND o.status = ANY($3)
       AND o.rental_start <= $5 AND $4 <= o.rental_end
     ORDER BY o.id`,
    [b.kebaya_id, b.id, BLOCKING, b.rental_start, b.rental_end],
  );
  if (!rows.length) return null;
  const list = rows.map((r) => `#${r.id} pada ${period.formatRange(new Date(r.rental_start), new Date(r.rental_end))}`);
  return new AppError(
    409,
    'KEBAYA_NOT_AVAILABLE',
    `${rows[0].code} sudah terkonfirmasi DP untuk pengajuan ${list.join(', ')}. DP tidak dapat dicatat.`,
    { data: { conflictWith: rows.map((r) => r.id) } },
  );
}

// Dipasang di /api/v1/admin/bookings; token sudah dicek requireAdmin di app.js.
function adminBookingRoutes() {
  const router = express.Router();

  router.param('id', checkId(notFound));

  // Kontrak tidak mengatur urutan: pengajuan terbaru dulu, id sebagai penentu jika waktunya sama.
  router.get('/', async (req, res) => {
    const f = validate(listSchema, req.query);
    const filtered = `${SELECT_BOOKING}
      WHERE ($1::text[] IS NULL OR b.status = ANY($1))
        AND ($2::int IS NULL OR b.kebaya_id = $2)
        AND ($3::date IS NULL OR b.use_date >= $3)
        AND ($4::date IS NULL OR b.use_date <= $4)
        AND ($5::boolean IS NULL OR (cardinality(dup.ids) > 0) = $5)`;
    const params = [f.status ?? null, f.kebayaId ?? null, f.from ?? null, f.to ?? null, f.hasDuplicate ?? null];
    const [{ rows }, { rows: count }] = await Promise.all([
      db.query(`${filtered} ORDER BY b.created_at DESC, b.id DESC LIMIT $6 OFFSET $7`, [
        ...params,
        f.limit,
        (f.page - 1) * f.limit,
      ]),
      // Dihitung terpisah supaya total tetap benar di halaman yang sudah kosong.
      db.query(`SELECT count(*)::int AS total FROM (${filtered}) t`, params),
    ]);
    res.json({
      status: 'success',
      data: { bookings: rows.map(toBooking), pagination: { page: f.page, limit: f.limit, total: count[0].total } },
    });
  });

  router.get('/:id', async (req, res) => {
    res.json({ status: 'success', data: await findBooking(req.params.id) });
  });

  router.patch('/:id/fitting', async (req, res) => {
    const { needsFitting, adminNote: note } = validate(fittingSchema, req.body ?? {});
    // Status dicek di UPDATE yang sama, supaya tidak balapan dengan perubahan status.
    const { rowCount } = await db.query(
      `UPDATE bookings SET needs_fitting = $2, admin_note = CASE WHEN $3 THEN $4 ELSE admin_note END
       WHERE id = $1 AND status IN ('pending', 'dp_paid')`,
      [req.params.id, needsFitting, note !== undefined, note || null],
    );
    if (!rowCount) {
      await findBooking(req.params.id); // 404 jika pengajuannya memang tidak ada
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        'Data fitting hanya dapat diubah untuk pengajuan berstatus Menunggu atau DP tercatat',
      );
    }
    res.json({ status: 'success', message: 'Data fitting berhasil disimpan', data: await findBooking(req.params.id) });
  });

  router.patch('/:id/status', async (req, res) => {
    const body = validate(statusSchema, req.body ?? {});
    const target = body.status;
    const client = await db.connect();
    let b;
    try {
      await client.query('BEGIN');
      ({ rows: [b] } = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [req.params.id]));
      if (!b) throw notFound();
      if (!NEXT[b.status]?.includes(target)) {
        throw new AppError(
          409,
          'INVALID_STATUS_TRANSITION',
          `Pengajuan berstatus ${LABEL[b.status]} tidak dapat diubah menjadi ${LABEL[target]}`,
        );
      }
      if (target === 'dp_paid') {
        // Kontrak 2.4: row lock pada kebaya, jadi dua pencatatan DP bersamaan diperiksa bergantian.
        const { rows: [kebaya] } = await client.query('SELECT code, is_active FROM kebaya WHERE id = $1 FOR UPDATE', [
          b.kebaya_id,
        ]);
        // Kontrak 1.3: KEBAYA_NOT_AVAILABLE juga untuk kebaya nonaktif; bentuk data sama dengan kasus bentrok.
        if (!kebaya.is_active) {
          throw new AppError(409, 'KEBAYA_NOT_AVAILABLE', `${kebaya.code} sedang nonaktif. DP tidak dapat dicatat.`, {
            data: { conflictWith: [] },
          });
        }
        const conflict = await conflictError(client, b);
        if (conflict) throw conflict;
      }
      // Waktu tiap tahap wajib terisi menurut CHECK tabel bookings; default waktu sekarang.
      const note = ['rejected', 'cancelled'].includes(target) ? body.adminNote : undefined;
      await client.query(
        `UPDATE bookings SET
           status         = $2,
           dp_amount      = COALESCE($3, dp_amount),
           dp_paid_at     = CASE WHEN $2 = 'dp_paid'     THEN COALESCE($4, now()) ELSE dp_paid_at END,
           paid_off_at    = CASE WHEN $2 = 'paid_off'    THEN COALESCE($4, now()) ELSE paid_off_at END,
           handed_over_at = CASE WHEN $2 = 'handed_over' THEN COALESCE($4, now()) ELSE handed_over_at END,
           returned_at    = CASE WHEN $2 = 'returned'    THEN COALESCE($4, now()) ELSE returned_at END,
           admin_note     = CASE WHEN $5 THEN $6 ELSE admin_note END
         WHERE id = $1`,
        [
          b.id,
          target,
          target === 'dp_paid' ? body.dpAmount : null,
          (['dp_paid', 'paid_off'].includes(target) ? body.paidAt : body.at) ?? null,
          note !== undefined,
          note || null,
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      // Pengaman terakhir: constraint bookings_no_overlap (SQLSTATE 23P01, kontrak 6) -> 409 yang sama.
      if (err.code === '23P01') {
        throw (
          (await conflictError(db, b)) ??
          new AppError(409, 'KEBAYA_NOT_AVAILABLE', 'Kebaya sudah terkonfirmasi DP pada periode yang tumpang tindih', {
            data: { conflictWith: [] },
          })
        );
      }
      throw err;
    } finally {
      client.release();
    }
    res.json({ status: 'success', message: 'Status pengajuan berhasil diubah', data: await findBooking(b.id) });
  });

  return router;
}

module.exports = { adminBookingRoutes, BLOCKING };
