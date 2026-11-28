// Endpoint pengajuan admin tanpa database: token, validasi, dan id yang mustahil ada.
// Perilaku yang butuh PostgreSQL ada di admin-bookings.db.test.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';
const db = require('../src/db');
const { createApp } = require('../src/app');

// Semua kasus di file ini harus ditolak sebelum query pertama; kalau tidak, route membalas 500.
db.query = db.connect = async () => {
  throw new Error('Tes ini tidak boleh menyentuh database');
};

let server, base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api/v1/admin/bookings`;
});
after(() => server.close());

const token = jwt.sign({ sub: '1', username: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 60 });
const api = async (method, path = '', body, headers = { authorization: `Bearer ${token}` }) => {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const errorFields = (res) => res.body.errors.map((e) => e.field).sort();

test('semua endpoint tanpa token -> 401 UNAUTHORIZED', async () => {
  for (const [method, path, body] of [
    ['GET', ''],
    ['GET', '/1'],
    ['PATCH', '/1/fitting', { needsFitting: true }],
    ['PATCH', '/1/status', { status: 'rejected' }],
  ]) {
    const res = await api(method, path, body, {});
    assert.equal(res.status, 401, `${method} ${path}`);
    assert.equal(res.body.code, 'UNAUTHORIZED');
  }
});

test('GET daftar dengan filter tidak valid -> 400 VALIDATION_ERROR per field', async () => {
  const res = await api(
    'GET',
    '?status=pending,disetujui&kebayaId=abc&from=2026-02-30&to=20261201&hasDuplicate=mungkin&page=0&limit=101',
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'VALIDATION_ERROR');
  assert.deepEqual(errorFields(res), ['from', 'hasDuplicate', 'kebayaId', 'limit', 'page', 'status', 'to']);
  assert.deepEqual(res.body.errors.find((e) => e.field === 'status'), {
    field: 'status',
    message: 'Filter status harus salah satu dari: pending, rejected, dp_paid, paid_off, handed_over, returned, cancelled',
  });
  assert.deepEqual(errorFields(await api('GET', '?from=0000-01-01&to=2026-12-01')), ['from']);
});

test('id bukan angka / di luar integer -> 404 NOT_FOUND', async () => {
  for (const [method, path, body] of [
    ['GET', '/abc'],
    ['GET', '/2147483648'],
    ['PATCH', '/abc/fitting', { needsFitting: true }],
    ['PATCH', '/99999999999/status', { status: 'rejected' }],
  ]) {
    const res = await api(method, path, body);
    assert.equal(res.status, 404, `${method} ${path}`);
    assert.deepEqual(res.body, { status: 'fail', code: 'NOT_FOUND', message: 'Pengajuan tidak ditemukan' });
  }
});

test('PATCH fitting dengan body tidak valid -> 400', async () => {
  const res = await api('PATCH', '/1/fitting', { needsFitting: 'mungkin', adminNote: 'x'.repeat(501) });
  assert.equal(res.status, 400);
  assert.deepEqual(errorFields(res), ['adminNote', 'needsFitting']);
  assert.deepEqual(errorFields(await api('PATCH', '/1/fitting', {})), ['needsFitting']);
});

test('PATCH status dengan body tidak valid -> 400 per field', async () => {
  for (const [body, fields] of [
    [{}, ['status']],
    [{ status: 'disetujui' }, ['status']],
    [{ status: 'dp_paid' }, ['dpAmount']],
    [{ status: 'dp_paid', dpAmount: 0 }, ['dpAmount']],
    [{ status: 'dp_paid', dpAmount: 50000.5 }, ['dpAmount']],
    [{ status: 'dp_paid', dpAmount: 50000, paidAt: 'kemarin' }, ['paidAt']],
    [{ status: 'returned', at: '2026-13-01T10:00:00Z' }, ['at']],
  ]) {
    const res = await api('PATCH', '/1/status', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(errorFields(res), fields, JSON.stringify(body));
  }
  const res = await api('PATCH', '/1/status', { status: 'dp_paid' });
  assert.deepEqual(res.body.errors, [{ field: 'dpAmount', message: 'Jumlah DP wajib diisi' }]);
});
