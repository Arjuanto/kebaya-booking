const express = require('express');
const cors = require('cors');
const { authRoutes } = require('./routes/auth');
const { adminKebayaRoutes } = require('./routes/admin-kebaya');
const { adminBookingRoutes } = require('./routes/admin-bookings');
const { requireAdmin } = require('./middleware/auth');
const { AppError, errorHandler } = require('./errors');

function createApp() {
  const app = express();
  // Render ada di belakang 1 proxy; tanpa ini rate limit login memakai IP proxy (kontrak bagian 4).
  app.set('trust proxy', 1);
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  app.use(express.json());

  app.use('/api/v1/auth', authRoutes());
  // Kontrak bagian 4: semua endpoint /admin/* wajib token.
  app.use('/api/v1/admin', requireAdmin);
  app.use('/api/v1/admin/kebaya', adminKebayaRoutes());
  app.use('/api/v1/admin/bookings', adminBookingRoutes());

  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
