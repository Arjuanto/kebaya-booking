// Endpoint publik (kontrak 3) tanpa database: validasi input, "hari ini" di Asia/Jakarta, id yang mustahil ada,
// dan /health saat database mati. Perilaku yang butuh PostgreSQL ada di public.db.test.js.
process.env.TZ = 'UTC'; // seperti server Render: jam server 7 jam di belakang WIB
process.env.ML_API_KEY = 'test-key';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mlMock } = require('./helpers/ml-mock');
const db = require('../src/db');
const { createApp } = require('../src/app');

// Kasus di file ini harus ditolak sebelum query pertama; kalau tidak, route membalas 500.
// Tes yang memang lolos validasi mengganti reply dengan hasil kosong.
let reply;
db.query = db.connect = async () => reply();
const untouched = () => {
  throw new Error('Tes ini tidak boleh menyentuh database');
};

const ml = mlMock();
let server, base;
before(async () => {
  await ml.start();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api/v1`;
});
after(() => {
  server.close();
  ml.stop();
});
beforeEach(() => {
  reply = untouched;
  ml.reset();
});

const api = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const invalid = (errors) => ({
  status: 'fail',
  code: 'VALIDATION_ERROR',
  message: 'Data yang dikirim tidak valid',
  errors,
});

test('GET /kebaya/available tanpa query -> 400 VALIDATION_ERROR per field', async () => {
  const res = await api('GET', '/kebaya/available');
  assert.equal(res.status, 400);
  assert.deepEqual(
    res.body,
    invalid([
      { field: 'useDate', message: 'Tanggal pemakaian wajib diisi' },
      { field: 'ld', message: 'Lingkar dada wajib diisi' },
      { field: 'tb', message: 'Tinggi badan wajib diisi' },
      { field: 'bb', message: 'Berat badan wajib diisi' },
    ]),
  );
  // Nilai kosong sama dengan tidak diisi.
  assert.deepEqual((await api('GET', '/kebaya/available?useDate=&ld=&tb=&bb=&category=')).body, res.body);
});

test('GET /kebaya/available dengan nilai tidak valid -> pesan per field seperti contoh kontrak 1.2', async () => {
  const res = await api('GET', '/kebaya/available?useDate=2026-02-30&ld=59&tb=abc&bb=150.5&category=gaun');
  assert.equal(res.status, 400);
  assert.deepEqual(
    res.body,
    invalid([
      { field: 'useDate', message: 'Tanggal pemakaian harus berupa tanggal yang valid' },
      { field: 'ld', message: 'Lingkar dada harus angka antara 60 dan 150' },
      { field: 'tb', message: 'Tinggi badan harus angka antara 130 dan 200' },
      { field: 'bb', message: 'Berat badan harus angka antara 30 dan 150' },
      { field: 'category', message: 'Kategori harus salah satu dari: kebaya, kemeja_couple' },
    ]),
  );
  for (const useDate of ['20261220', '2026-12-20T00:00:00Z', '0000-12-20']) {
    const r = await api('GET', `/kebaya/available?useDate=${useDate}&ld=88&tb=158&bb=52`);
    assert.deepEqual(r.body.errors, [{ field: 'useDate', message: 'Tanggal pemakaian harus berupa tanggal yang valid' }], useDate);
  }
  const r = await api('GET', '/kebaya/available?useDate=2099-12-20&ld=150.1&tb=200.1&bb=29.9');
  assert.deepEqual(
    r.body.errors.map((e) => e.field),
    ['ld', 'tb', 'bb'],
  );
});

test('"hari ini" dihitung di Asia/Jakarta, bukan jam server: useDate hari ini atau lampau -> 400', async (t) => {
  reply = () => ({ rows: [] });
  const check = async (useDate) => {
    const res = await api('GET', `/kebaya/available?useDate=${useDate}&ld=88&tb=158&bb=52`);
    return res.status === 200 ? 'lolos' : res.body.errors;
  };
  const notTomorrow = [{ field: 'useDate', message: 'Tanggal pemakaian paling cepat besok' }];

  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-12-19T16:59:59Z') }); // 23:59:59 WIB, 19 Des
  assert.deepEqual(await check('2026-12-18'), notTomorrow);
  assert.deepEqual(await check('2026-12-19'), notTomorrow);
  assert.equal(await check('2026-12-20'), 'lolos');

  // 00:00 WIB, 20 Des. Tanggal UTC (jam server Render) masih 19 Des.
  t.mock.timers.setTime(Date.parse('2026-12-19T17:00:00Z'));
  assert.deepEqual(await check('2026-12-20'), notTomorrow);
  assert.equal(await check('2026-12-21'), 'lolos');
});

test('batas rentang ukuran badan (60–150, 130–200, 30–150) masih diterima', async () => {
  reply = () => ({ rows: [] });
  for (const q of ['ld=60&tb=130&bb=30', 'ld=150&tb=200&bb=150', 'ld=88.5&tb=158.2&bb=52.7']) {
    const res = await api('GET', `/kebaya/available?useDate=2099-12-20&${q}`);
    assert.equal(res.status, 200, q);
  }
});

test('POST /bookings tanpa data -> 400 per field, tidak ada yang tersimpan', async () => {
  const res = await api('POST', '/bookings', {});
  assert.equal(res.status, 400);
  assert.deepEqual(
    res.body,
    invalid([
      { field: 'customerName', message: 'Nama wajib diisi' },
      { field: 'eventPurpose', message: 'Keperluan acara wajib diisi' },
      { field: 'useDate', message: 'Tanggal pemakaian wajib diisi' },
      { field: 'ld', message: 'Lingkar dada wajib diisi' },
      { field: 'tb', message: 'Tinggi badan wajib diisi' },
      { field: 'bb', message: 'Berat badan wajib diisi' },
      { field: 'kebayaId', message: 'ID kebaya wajib diisi' },
    ]),
  );
  assert.deepEqual(ml.requests, []);
});

test('POST /bookings dengan data tidak masuk akal -> 400 per field (kontrak 2.2)', async () => {
  const res = await api('POST', '/bookings', {
    customerName: ' S ',
    customerContact: 'x'.repeat(51),
    useDate: '2026-13-01',
    eventPurpose: 'arisan',
    ld: 'delapan puluh',
    tb: 129,
    bb: 151,
    kebayaId: 1.5,
  });
  assert.equal(res.status, 400);
  assert.deepEqual(
    res.body,
    invalid([
      { field: 'customerName', message: 'Nama minimal 2 karakter' },
      { field: 'customerContact', message: 'Kontak maksimal 50 karakter' },
      {
        field: 'eventPurpose',
        message: 'Keperluan acara harus salah satu dari: wisuda, kartini, pernikahan, lamaran, lainnya',
      },
      { field: 'useDate', message: 'Tanggal pemakaian harus berupa tanggal yang valid' },
      { field: 'ld', message: 'Lingkar dada harus angka antara 60 dan 150' },
      { field: 'tb', message: 'Tinggi badan harus angka antara 130 dan 200' },
      { field: 'bb', message: 'Berat badan harus angka antara 30 dan 150' },
      { field: 'kebayaId', message: 'ID kebaya harus bilangan bulat' },
    ]),
  );

  const valid = { customerName: 'Sinta', useDate: '2099-12-20', eventPurpose: 'wisuda', ld: 88, tb: 158, bb: 52, kebayaId: 1 };
  for (const [patch, errors] of [
    [{ customerName: '   ' }, [{ field: 'customerName', message: 'Nama wajib diisi' }]],
    [{ customerName: 'x'.repeat(101) }, [{ field: 'customerName', message: 'Nama maksimal 100 karakter' }]],
    [{ useDate: '2000-01-01' }, [{ field: 'useDate', message: 'Tanggal pemakaian paling cepat besok' }]],
    [{ kebayaId: 0 }, [{ field: 'kebayaId', message: 'ID kebaya minimal 1' }]],
  ]) {
    const r = await api('POST', '/bookings', { ...valid, ...patch });
    assert.deepEqual(r.body.errors, errors, JSON.stringify(patch));
  }
  assert.deepEqual(ml.requests, []);
});

test('GET /kebaya/:id dengan id bukan angka / di luar integer -> 404 tanpa query', async () => {
  for (const id of ['abc', '2147483648', '1.5']) {
    const res = await api('GET', `/kebaya/${id}`);
    assert.equal(res.status, 404, id);
    assert.deepEqual(res.body, { status: 'fail', code: 'NOT_FOUND', message: 'Kebaya tidak ditemukan' });
  }
});

test('GET /health saat database mati -> tetap 200 dengan db "down"', async (t) => {
  t.mock.method(console, 'error', () => {});
  const res = await api('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'success', data: { db: 'down', mlService: 'ok' } });
  assert.equal(console.error.mock.callCount(), 1); // penyebabnya dicatat di log
});
