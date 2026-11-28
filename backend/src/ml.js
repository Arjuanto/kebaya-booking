const Joi = require('joi');
const { SIZES } = require('./routes/admin-kebaya');

// Jawaban POST /v1/size-estimate (kontrak 5). Ukuran di luar enum kebaya dianggap gagal: kolom
// bookings.estimated_size dibatasi CHECK yang sama, jadi pengajuan tidak akan bisa disimpan.
const estimateSchema = Joi.object({
  size: Joi.string()
    .valid(...SIZES)
    .allow(null)
    .required(),
  inRange: Joi.boolean().required(),
  message: Joi.string().required(),
  tableVersion: Joi.string().max(30).required(), // varchar(30) bookings.size_table_version
});

// Kontrak 5: hanya dipanggil backend, dengan X-API-Key, timeout ML_TIMEOUT_MS (default 10 detik), tanpa retry.
async function callMl(path, body) {
  const res = await fetch(new URL(path, process.env.ML_SERVICE_URL), {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ML_API_KEY ?? '' },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.ML_TIMEOUT_MS) || 10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Perkiraan ukuran { size, inRange, message, tableVersion }, atau null jika layanan model gagal, timeout, atau
// membalas di luar kontrak. Kegagalan dicatat di log; 401 berarti ML_API_KEY salah konfigurasi (kontrak 5).
async function estimateSize({ ld, tb, bb }) {
  try {
    return Joi.attempt(await callMl('/v1/size-estimate', { ld, tb, bb }), estimateSchema, { stripUnknown: true });
  } catch (err) {
    console.error('Perkiraan ukuran dari layanan model gagal:', err.message);
    return null;
  }
}

// GET /v1/health: true jika layanan model membalas 2xx dalam batas timeout.
const mlHealthy = () => callMl('/v1/health').then(
  () => true,
  () => false,
);

module.exports = { estimateSize, mlHealthy };
