const express = require('express');
const cors = require('cors');
const { publicRoutes } = require('./routes/public');
const { authRoutes } = require('./routes/auth');
const { adminKebayaRoutes } = require('./routes/admin-kebaya');
const { adminBookingRoutes } = require('./routes/admin-bookings');
const { kebayaFotoRoutes } = require('./routes/kebaya-foto');
const { requireAdmin } = require('./middleware/auth');
const { AppError, errorHandler } = require('./errors');

function createApp() {
  const app = express();
  // Render ada di belakang 1 proxy; tanpa ini rate limit login memakai IP proxy (kontrak bagian 4).
  app.set('trust proxy', 1);
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  // Kontrak bagian 4: semua endpoint /admin/* wajib token. Dicek sebelum body dibaca (requireAdmin hanya
  // membaca header), supaya body sampai 3 MB tanpa token langsung ditolak tanpa diproses.
  app.use('/api/v1/admin', requireAdmin);
  // Foto kebaya dikirim base64 di JSON (maks 2 MB, kontrak 2.1); route lain tetap memakai batas bawaan 100 KB.
  app.use('/api/v1/admin/kebaya', express.json({ limit: '3mb' }));
  app.use(express.json());

  app.use('/api/v1', publicRoutes()); // kontrak 3: tanpa token
  app.use('/api/v1/auth', authRoutes());
  app.use('/api/v1/kebaya', kebayaFotoRoutes());
  app.use('/api/v1/admin/kebaya', adminKebayaRoutes());
  app.use('/api/v1/admin/bookings', adminBookingRoutes());

  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
