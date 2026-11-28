const express = require('express');
const db = require('../db');
const { AppError, checkId } = require('../errors');

const notFound = () => new AppError(404, 'NOT_FOUND', 'Kebaya tidak ditemukan');

// Dipasang di /api/v1/kebaya. Kontrak bagian 3: tanpa login dan juga untuk kebaya nonaktif,
// karena tag <img> tidak bisa mengirim token admin.
function kebayaFotoRoutes() {
  const router = express.Router();

  router.param('id', checkId(notFound));

  router.get('/:id/foto', async (req, res) => {
    const { rows } = await db.query('SELECT photo, photo_type FROM kebaya WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound();
    // photoUrl memuat ?v=updatedAt, jadi aman di-cache lama. nosniff: browser tidak menebak jenis file lain.
    res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    res.type(rows[0].photo_type).send(rows[0].photo);
  });

  return router;
}

module.exports = { kebayaFotoRoutes };
