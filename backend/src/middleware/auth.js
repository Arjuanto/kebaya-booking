const jwt = require('jsonwebtoken');
const { unauthorized } = require('../errors');

// Pasang di semua route /admin/*. Mengisi req.admin = { id, username }.
function requireAdmin(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.admin = { id: Number(payload.sub), username: payload.username };
    next();
  } catch {
    next(unauthorized('Sesi berakhir, silakan login kembali'));
  }
}

module.exports = { requireAdmin };
