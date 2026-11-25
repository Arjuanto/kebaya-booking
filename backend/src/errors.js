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

// Validasi Joi -> 400 VALIDATION_ERROR dengan daftar field.
function validate(schema, value) {
  const { error, value: clean } = schema.validate(value, { abortEarly: false, stripUnknown: true });
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
  console.error(err);
  res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' });
}

module.exports = { AppError, unauthorized, validate, errorHandler };
