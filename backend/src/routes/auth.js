const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const { unauthorized, validate } = require('../errors');
const { requireAdmin } = require('../middleware/auth');

const EXPIRES_IN = 8 * 60 * 60; // detik, kontrak: JWT berlaku 8 jam
// Dibandingkan saat username tidak ada, supaya waktu respons tidak membocorkan username yang valid.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const loginSchema = Joi.object({
  username: Joi.string().trim().max(50).required().messages({
    'any.required': 'Username wajib diisi',
    'string.empty': 'Username wajib diisi',
    'string.base': 'Username harus berupa teks',
    'string.max': 'Username maksimal 50 karakter',
  }),
  password: Joi.string().max(200).required().messages({
    'any.required': 'Password wajib diisi',
    'string.empty': 'Password wajib diisi',
    'string.base': 'Password harus berupa teks',
    'string.max': 'Password maksimal 200 karakter',
  }),
});

// Router dibuat per app supaya hitungan rate limit tidak terbawa antar instance (mis. di test).
function authRoutes() {
  const router = express.Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        status: 'fail',
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
      }),
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = validate(loginSchema, req.body ?? {});
    const { rows } = await db.query('SELECT id, username, password_hash FROM admins WHERE username = $1', [username]);
    const admin = rows[0];
    const ok = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
    if (!admin || !ok) throw unauthorized('Username atau password salah');

    const token = jwt.sign({ sub: String(admin.id), username: admin.username }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: EXPIRES_IN,
    });
    res.json({
      status: 'success',
      message: 'Login berhasil',
      data: { token, expiresIn: EXPIRES_IN, admin: { id: admin.id, username: admin.username } },
    });
  });

  router.get('/me', requireAdmin, (req, res) => {
    res.json({ status: 'success', data: { admin: req.admin } });
  });

  return router;
}

module.exports = { authRoutes };
