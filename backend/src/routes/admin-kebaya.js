const express = require('express');
const Joi = require('joi');
const db = require('../db');
const { AppError, checkId, validate } = require('../errors');

const CATEGORIES = ['kebaya', 'kemeja_couple'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'ALL_SIZE'];

// Kontrak 2.1: foto dikirim sebagai data URL base64, hanya JPEG/PNG/WebP, maks 2 MB setelah di-decode.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
// Byte awal tiap format: isi file harus cocok dengan jenisnya, bukan cuma label di data URL.
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  'image/webp': (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
};

// Data URL -> { type, data }; yang disimpan ke database adalah isi file (bytea) dan jenisnya.
function decodePhoto(value, helpers) {
  const match = DATA_URL.exec(value);
  if (!match) return helpers.error('photo.type');
  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_PHOTO_BYTES) return helpers.error('photo.tooLarge');
  if (!SIGNATURES[match[1]](data)) return helpers.error('photo.type');
  return { type: match[1], data };
}

// Kontrak 2.1. isActive sengaja tanpa default di sini: POST memakai true, PUT mempertahankan nilai lama.
const kebayaSchema = Joi.object({
  // Disimpan huruf besar supaya "kb-013" bentrok dengan "KB-013" di constraint unik.
  code: Joi.string().trim().uppercase().max(20).required().label('Kode'),
  name: Joi.string().trim().max(100).required().label('Nama'),
  category: Joi.string().valid(...CATEGORIES).required().label('Kategori'),
  size: Joi.string().valid(...SIZES).required().label('Ukuran'),
  photo: Joi.string().custom(decodePhoto).required().label('Foto').messages({
    'string.base': '{#label} harus berupa file JPEG, PNG, atau WebP',
    'photo.type': '{#label} harus berupa file JPEG, PNG, atau WebP',
    'photo.tooLarge': '{#label} maksimal 2 MB',
  }),
  description: Joi.string().trim().max(500).allow(null).empty('').default(null).label('Deskripsi'),
  isActive: Joi.boolean().label('Status aktif'),
});

// PUT: foto opsional, tidak dikirim berarti foto lama tetap dipakai (kontrak bagian 4).
const kebayaUpdateSchema = kebayaSchema.fork('photo', (s) => s.optional());

const activeSchema = Joi.object({
  isActive: Joi.boolean().required().label('Status aktif'),
});

// Nilai kosong (mis. ?category=) berarti tanpa filter.
const listSchema = Joi.object({
  isActive: Joi.boolean().empty('').label('Filter status'),
  category: Joi.string().valid(...CATEGORIES).empty('').label('Filter kategori'),
  q: Joi.string().trim().max(100).empty('').label('Kata kunci'),
});

const notFound = () => new AppError(404, 'NOT_FOUND', 'Kebaya tidak ditemukan');

// Kontrak bagian 6. Di tabel kebaya, SQLSTATE 23505 hanya bisa datang dari kolom unik code.
function duplicateCode(err) {
  if (err.code === '23505') throw new AppError(409, 'DUPLICATE_CODE', 'Kode kebaya sudah dipakai');
  throw err;
}

// Semua kolom kecuali photo: isi file foto hanya dibaca GET /kebaya/:id/foto (kontrak bagian 6).
const KEBAYA_COLUMNS = 'id, code, name, category, size, description, is_active, created_at, updated_at';

// Baris tabel (snake_case) -> objek Kebaya kontrak 2.1 (camelCase).
const toKebaya = (r) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  category: r.category,
  size: r.size,
  // Relatif ke base URL API; v ikut berganti tiap kebaya diubah supaya browser tidak memakai foto lama.
  photoUrl: `/kebaya/${r.id}/foto?v=${Math.floor(r.updated_at.getTime() / 1000)}`,
  description: r.description,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// Dipasang di /api/v1/admin/kebaya; token sudah dicek requireAdmin di app.js.
function adminKebayaRoutes() {
  const router = express.Router();

  router.param('id', checkId(notFound));

  router.get('/', async (req, res) => {
    const { isActive = null, category = null, q = null } = validate(listSchema, req.query);
    const { rows } = await db.query(
      `SELECT ${KEBAYA_COLUMNS} FROM kebaya
       WHERE ($1::boolean IS NULL OR is_active = $1)
         AND ($2::text IS NULL OR category = $2)
         AND ($3::text IS NULL OR strpos(lower(code), lower($3)) > 0 OR strpos(lower(name), lower($3)) > 0)
       ORDER BY code`,
      [isActive, category, q],
    );
    res.json({ status: 'success', message: `Ditemukan ${rows.length} kebaya`, data: { kebaya: rows.map(toKebaya) } });
  });

  router.get('/:id', async (req, res) => {
    const { rows } = await db.query(`SELECT ${KEBAYA_COLUMNS} FROM kebaya WHERE id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound();
    res.json({ status: 'success', data: toKebaya(rows[0]) });
  });

  router.post('/', async (req, res) => {
    const k = validate(kebayaSchema, req.body ?? {});
    const { rows } = await db
      .query(
        `INSERT INTO kebaya (code, name, category, size, photo, photo_type, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${KEBAYA_COLUMNS}`,
        [k.code, k.name, k.category, k.size, k.photo.data, k.photo.type, k.description, k.isActive ?? true],
      )
      .catch(duplicateCode);
    res.status(201).json({ status: 'success', message: 'Kebaya berhasil ditambahkan', data: toKebaya(rows[0]) });
  });

  router.put('/:id', async (req, res) => {
    const k = validate(kebayaUpdateSchema, req.body ?? {});
    // photo / isActive null (tidak dikirim) -> nilai lama dipakai, supaya edit tidak mengaktifkan ulang kebaya.
    const { rows } = await db
      .query(
        `UPDATE kebaya
         SET code = $1, name = $2, category = $3, size = $4,
             photo = COALESCE($5, photo), photo_type = COALESCE($6, photo_type), description = $7,
             is_active = COALESCE($8, is_active)
         WHERE id = $9 RETURNING ${KEBAYA_COLUMNS}`,
        [
          k.code,
          k.name,
          k.category,
          k.size,
          k.photo?.data ?? null,
          k.photo?.type ?? null,
          k.description,
          k.isActive ?? null,
          req.params.id,
        ],
      )
      .catch(duplicateCode);
    if (!rows[0]) throw notFound();
    res.json({ status: 'success', message: 'Kebaya berhasil diperbarui', data: toKebaya(rows[0]) });
  });

  router.patch('/:id/active', async (req, res) => {
    const { isActive } = validate(activeSchema, req.body ?? {});
    const { rows } = await db.query(`UPDATE kebaya SET is_active = $1 WHERE id = $2 RETURNING ${KEBAYA_COLUMNS}`, [
      isActive,
      req.params.id,
    ]);
    if (!rows[0]) throw notFound();
    res.json({
      status: 'success',
      message: isActive ? 'Kebaya berhasil diaktifkan' : 'Kebaya berhasil dinonaktifkan',
      data: toKebaya(rows[0]),
    });
  });

  return router;
}

module.exports = { adminKebayaRoutes, toKebaya, KEBAYA_COLUMNS, CATEGORIES, SIZES };
