// Error yang dilempar route; dipetakan ke format respons gagal kontrak (bagian 1.2).
class AppError extends Error {
  constructor(httpStatus, code, message, extra = {}) {
    super(message);
    this.httpStatus = httpStatus;
    this.code = code;
    this.extra = extra; // { errors } atau { data }
  }
}

const unauthorized = (message = 'Silakan login terlebih dahulu') =>
  new AppError(401, 'UNAUTHORIZED', message);

// Handler router.param('id'): id yang bukan integer Postgres pasti tidak ada, jadi langsung 404 tanpa query
// (tanpa cek ini database melempar error dan jadi 500).
function checkId(notFound) {
  return (req, res, next, id) => {
    if (!/^\d{1,10}$/.test(id) || Number(id) > 2147483647) return next(notFound());
    next();
  };
}

// Pesan Joi berbahasa Indonesia untuk semua schema; {#label} = nama field yang ramah pengguna.
// Pesan yang ditulis di schema sendiri (mis. login) tetap menang.
const joiPrefs = {
  errors: { wrap: { label: false, array: false } },
  messages: {
    'object.base': 'Data harus berupa objek JSON',
    'any.required': '{#label} wajib diisi',
    'string.empty': '{#label} wajib diisi',
    'string.base': '{#label} harus berupa teks',
    'string.max': '{#label} maksimal {#limit} karakter',
    'any.only': '{#label} harus salah satu dari: {#valids}',
    'boolean.base': '{#label} harus bernilai true atau false',
    'number.base': '{#label} harus berupa angka',
    'number.integer': '{#label} harus bilangan bulat',
    'number.min': '{#label} minimal {#limit}',
    'number.max': '{#label} maksimal {#limit}',
    'number.positive': '{#label} harus lebih dari 0',
    'date.base': '{#label} harus berupa tanggal yang valid',
    'date.format': '{#label} harus berupa waktu ISO 8601, mis. 2026-12-01T10:15:00+07:00',
  },
};

// Validasi Joi -> 400 VALIDATION_ERROR dengan daftar field.
function validate(schema, value) {
  const { error, value: clean } = schema.validate(value, { abortEarly: false, stripUnknown: true, ...joiPrefs });
  if (error) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid', {
      errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }
  return clean;
}

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({
      status: err.httpStatus >= 500 ? 'error' : 'fail',
      code: err.code,
      message: err.message,
      ...err.extra,
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'fail', code: 'VALIDATION_ERROR', message: 'Format JSON tidak valid' });
  }
  // Body melebihi batas express.json. Hanya katalog admin yang menerima body besar, dan di sana penyebabnya foto.
  if (err.type === 'entity.too.large') {
    const photo = req.originalUrl.startsWith('/api/v1/admin/kebaya');
    return res.status(400).json({
      status: 'fail',
      code: 'VALIDATION_ERROR',
      message: 'Data yang dikirim terlalu besar',
      ...(photo && { errors: [{ field: 'photo', message: 'Foto maksimal 2 MB' }] }),
    });
  }
  console.error(err);
  res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' });
}

module.exports = { AppError, unauthorized, checkId, validate, errorHandler };
