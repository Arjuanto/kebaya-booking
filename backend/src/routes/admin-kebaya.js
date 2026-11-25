const express = require('express');
const Joi = require('joi');
const db = require('../db');
const { AppError, validate } = require('../errors');

const CATEGORIES = ['kebaya', 'kemeja_couple'];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'ALL_SIZE'];

// Pesan Joi berbahasa Indonesia; {#label} = nama field yang ramah pengguna.
const prefs = {
  errors: { wrap: { label: false, array: false } },
  messages: {
    'object.base': 'Data harus berupa objek JSON',
    'any.required': '{#label} wajib diisi',
    'string.empty': '{#label} wajib diisi',
    'string.base': '{#label} harus berupa teks',
    'string.max': '{#label} maksimal {#limit} karakter',
    'string.uri': '{#label} harus berupa URL http/https yang valid',
    'string.uriCustomScheme': '{#label} harus berupa URL http/https yang valid',
    'any.only': '{#label} harus salah satu dari: {#valids}',
    'boolean.base': '{#label} harus bernilai true atau false',
  },
};

// Kontrak 2.1. isActive sengaja tanpa default di sini: POST memakai true, PUT mempertahankan nilai lama.
const kebayaSchema = Joi.object({
  // Disimpan huruf besar supaya "kb-013" bentrok dengan "KB-013" di constraint unik.
  code: Joi.string().trim().uppercase().max(20).required().label('Kode'),
  name: Joi.string().trim().max(100).required().label('Nama'),
  category: Joi.string().valid(...CATEGORIES).required().label('Kategori'),
  size: Joi.string().valid(...SIZES).required().label('Ukuran'),
  photoUrl: Joi.string().trim().uri({ scheme: ['http', 'https'] }).required().label('URL foto'),
  description: Joi.string().trim().max(500).allow(null).empty('').default(null).label('Deskripsi'),
  isActive: Joi.boolean().label('Status aktif'),
}).prefs(prefs);

const activeSchema = Joi.object({
  isActive: Joi.boolean().required().label('Status aktif'),
}).prefs(prefs);

// Nilai kosong (mis. ?category=) berarti tanpa filter.
const listSchema = Joi.object({
  isActive: Joi.boolean().empty('').label('Filter status'),
  category: Joi.string().valid(...CATEGORIES).empty('').label('Filter kategori'),
  q: Joi.string().trim().max(100).empty('').label('Kata kunci'),
}).prefs(prefs);

const notFound = () => new AppError(404, 'NOT_FOUND', 'Kebaya tidak ditemukan');

// Kontrak bagian 6. Di tabel kebaya, SQLSTATE 23505 hanya bisa datang dari kolom unik code.
function duplicateCode(err) {
  if (err.code === '23505') throw new AppError(409, 'DUPLICATE_CODE', 'Kode kebaya sudah dipakai');
  throw err;
}

// Baris tabel (snake_case) -> objek Kebaya kontrak 2.1 (camelCase).
const toKebaya = (r) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  category: r.category,
  size: r.size,
  photoUrl: r.photo_url,
  description: r.description,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// Dipasang di /api/v1/admin/kebaya; token sudah dicek requireAdmin di app.js.
function adminKebayaRoutes() {
  const router = express.Router();

  // id yang bukan integer Postgres pasti tidak ada; tanpa cek ini database melempar error (500).
  router.param('id', (req, res, next, id) => {
    if (!/^\d{1,10}$/.test(id) || Number(id) > 2147483647) return next(notFound());
    next();
  });

  router.get('/', async (req, res) => {
    const { isActive = null, category = null, q = null } = validate(listSchema, req.query);
    const { rows } = await db.query(
      `SELECT * FROM kebaya
       WHERE ($1::boolean IS NULL OR is_active = $1)
         AND ($2::text IS NULL OR category = $2)
         AND ($3::text IS NULL OR strpos(lower(code), lower($3)) > 0 OR strpos(lower(name), lower($3)) > 0)
       ORDER BY code`,
      [isActive, category, q],
    );
    res.json({ status: 'success', message: `Ditemukan ${rows.length} kebaya`, data: { kebaya: rows.map(toKebaya) } });
  });

  router.get('/:id', async (req, res) => {
    const { rows } = await db.query('SELECT * FROM kebaya WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound();
    res.json({ status: 'success', data: toKebaya(rows[0]) });
  });

  router.post('/', async (req, res) => {
    const k = validate(kebayaSchema, req.body ?? {});
    const { rows } = await db
      .query(
        `INSERT INTO kebaya (code, name, category, size, photo_url, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [k.code, k.name, k.category, k.size, k.photoUrl, k.description, k.isActive ?? true],
      )
      .catch(duplicateCode);
    res.status(201).json({ status: 'success', message: 'Kebaya berhasil ditambahkan', data: toKebaya(rows[0]) });
  });

  router.put('/:id', async (req, res) => {
    const k = validate(kebayaSchema, req.body ?? {});
    // isActive null (tidak dikirim) -> status aktif tidak berubah, supaya edit tidak mengaktifkan ulang kebaya.
    const { rows } = await db
      .query(
        `UPDATE kebaya
         SET code = $1, name = $2, category = $3, size = $4, photo_url = $5, description = $6,
             is_active = COALESCE($7, is_active)
         WHERE id = $8 RETURNING *`,
        [k.code, k.name, k.category, k.size, k.photoUrl, k.description, k.isActive ?? null, req.params.id],
      )
      .catch(duplicateCode);
    if (!rows[0]) throw notFound();
    res.json({ status: 'success', message: 'Kebaya berhasil diperbarui', data: toKebaya(rows[0]) });
  });

  router.patch('/:id/active', async (req, res) => {
    const { isActive } = validate(activeSchema, req.body ?? {});
    const { rows } = await db.query('UPDATE kebaya SET is_active = $1 WHERE id = $2 RETURNING *', [
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

module.exports = { adminKebayaRoutes };
