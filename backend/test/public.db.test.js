// Endpoint publik (kontrak 3) ke PostgreSQL sungguhan, dengan layanan model palsu: ketersediaan dan kasus
// tepi masa sewa (kontrak 2.4), perkiraan ukuran dan sizeMatch, kegagalan layanan model, detail kebaya,
// kirim pengajuan, dan /health. Dilewati jika TEST_DATABASE_URL kosong; lihat test/helpers/test-db.js.
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { testDatabase } = require('./helpers/test-db');
const { mlMock, estimate } = require('./helpers/ml-mock');

const testDb = testDatabase();
if (testDb) process.env.DATABASE_URL = testDb.url; // sebelum require src/db: pool membaca DATABASE_URL saat dibuat
process.env.ML_API_KEY = 'test-key';
const db = require('../src/db');
const { createApp } = require('../src/app');

const T0 = '2026-11-25T02:00:00.000Z'; // createdAt/updatedAt kebaya contoh
// photoUrl dibuat backend dari id dan updatedAt (kontrak v0.5), bukan isi kolom.
const photoUrl = (id) => `/kebaya/${id}/foto?v=${Date.parse(T0) / 1000}`;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
// Tanggal pakai acuan, cukup jauh di depan supaya selalu lolos aturan "paling cepat besok".
const U = addDays(new Date().toISOString().slice(0, 10), 60);
const at = (n) => addDays(U, n);

const BLOCKING = ['dp_paid', 'paid_off', 'handed_over', 'returned'];
const NO_ESTIMATE = {
  available: false,
  size: null,
  inRange: null,
  message: 'Perkiraan ukuran sedang tidak tersedia, silakan hubungi admin untuk fitting',
};
const OUT_OF_TABLE = {
  size: null,
  inRange: false,
  message: 'Ukuran di luar tabel, silakan hubungi admin untuk fitting',
  tableVersion: 'sementara-1',
};

let kb; // id kebaya contoh per ukuran: { S, M, L, ALL, OFF }

// Tambah pengajuan langsung ke tabel. Masa sewa default kontrak 2.4: useDate − 1 s.d. useDate + 1 + 2.
// Kolom DP dan waktu tiap tahap diisi seperti yang diwajibkan CHECK tabel bookings.
async function book({ kebayaId = kb.M, useDate = U, status = 'pending' } = {}) {
  await db.query(
    `INSERT INTO bookings (kebaya_id, customer_name, use_date, event_purpose, ld, tb, bb,
       rental_start, rental_end, status, dp_amount, dp_paid_at, paid_off_at, handed_over_at, returned_at)
     VALUES ($1, 'Rani', $2, 'wisuda', 88, 158, 52, $2::date - 1, $2::date + 3, $3,
       CASE WHEN $3 NOT IN ('pending', 'rejected') THEN 50000 END,
       CASE WHEN $3 NOT IN ('pending', 'rejected') THEN now() END,
       CASE WHEN $3 IN ('paid_off', 'handed_over', 'returned') THEN now() END,
       CASE WHEN $3 IN ('handed_over', 'returned') THEN now() END,
       CASE WHEN $3 = 'returned' THEN now() END)`,
    [kebayaId, useDate, status],
  );
}

describe('endpoint publik dengan PostgreSQL', { skip: !testDb && 'TEST_DATABASE_URL kosong' }, () => {
  const ml = mlMock();
  let server, base, mlUrl;
  before(async () => {
    await testDb.create();
    // Pengaman: TRUNCATE di bawah hanya boleh mengenai database tes.
    assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name, testDb.name);
    await ml.start();
    mlUrl = process.env.ML_SERVICE_URL;
    server = createApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://localhost:${server.address().port}/api/v1`;
  });
  after(async () => {
    server?.close();
    ml.stop();
    await db.end();
    await testDb.drop();
  });

  // Tiap tes mulai dari env default, layanan model normal, dan lima kebaya contoh tanpa pengajuan.
  const resetEnv = () => {
    process.env.ML_SERVICE_URL = mlUrl;
    for (const name of ['ML_TIMEOUT_MS', 'RENTAL_DAYS_BEFORE', 'RENTAL_DAYS_AFTER', 'LAUNDRY_DAYS']) delete process.env[name];
    ml.reset();
  };
  beforeEach(async () => {
    resetEnv();
    await db.query('TRUNCATE bookings, kebaya RESTART IDENTITY');
    const { rows } = await db.query(
      `INSERT INTO kebaya (code, name, category, size, is_active, photo, photo_type, created_at, updated_at)
       SELECT v.*, decode('ffd8ffe0', 'hex'), 'image/jpeg', $1::timestamptz, $1::timestamptz FROM (VALUES
         ('KB-001', 'Kebaya Encim Putih', 'kebaya', 'S', true),
         ('KB-002', 'Kebaya Kutubaru Hijau Sage', 'kebaya', 'M', true),
         ('KB-003', 'Kebaya Brokat Merah', 'kebaya', 'L', true),
         ('KB-004', 'Kemeja Couple Batik', 'kemeja_couple', 'ALL_SIZE', true),
         ('KB-005', 'Kebaya Kartini Biru', 'kebaya', 'M', false)
       ) AS v
       RETURNING id`,
      [T0],
    );
    kb = Object.fromEntries(['S', 'M', 'L', 'ALL', 'OFF'].map((k, i) => [k, rows[i].id]));
  });

  const api = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const available = (useDate, extra = '') => api('GET', `/kebaya/available?useDate=${useDate}&ld=88&tb=158&bb=52${extra}`);
  const codes = (res) => res.body.data.kebaya.map((k) => k.code);
  const form = (extra) => ({
    customerName: 'Sinta',
    customerContact: '0812-0000-0000',
    useDate: U,
    eventPurpose: 'wisuda',
    ld: 88,
    tb: 158,
    bb: 52,
    kebayaId: kb.M,
    ...extra,
  });
  const bookingCount = async () => (await db.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n;

  describe('GET /kebaya/available', () => {
    test('kebaya ber-DP hilang pada masa sewa yang tumpang tindih dan muncul lagi setelah jeda laundry', async () => {
      await book({ kebayaId: kb.M, useDate: U, status: 'dp_paid' }); // masa sewa U−1 (diambil) s.d. U+3 (jeda terakhir)
      // Masa sewa tanggal yang dicari: useDate − 1 s.d. useDate + 3.
      const cases = [
        [-5, true, 'H-5: jeda laundry pengajuan baru selesai sehari sebelum H-1 pengajuan DP'],
        [-4, false, 'H-4: jeda laundry pengajuan baru jatuh di H-1 pengajuan DP'],
        [-1, false, 'H-1 pengajuan DP'],
        [0, false, 'tanggal pakai pengajuan DP'],
        [1, false, 'H+1 pengajuan DP'],
        [2, false, 'hari jeda laundry pertama'],
        [3, false, 'hari jeda laundry terakhir'],
        [4, false, 'H+4 (hari setelah jeda): kebaya baru siap, tapi H-1 pengajuan baru jatuh di hari jeda terakhir'],
        [5, true, 'H+5: H-1 pengajuan baru jatuh sehari setelah jeda'],
      ];
      for (const [offset, shown, label] of cases) {
        const res = await available(at(offset));
        assert.equal(res.status, 200, label);
        assert.equal(codes(res).includes('KB-002'), shown, label);
        assert.ok(codes(res).includes('KB-001'), `kebaya lain tidak terpengaruh: ${label}`);
      }
    });

    test('yang memblokir hanya dp_paid, paid_off, handed_over, returned (kontrak 2.3)', async () => {
      for (const status of ['dp_paid', 'paid_off', 'handed_over', 'returned', 'pending', 'rejected', 'cancelled']) {
        await db.query('TRUNCATE bookings');
        await book({ kebayaId: kb.M, useDate: U, status });
        const res = await available(at(1));
        assert.equal(codes(res).includes('KB-002'), !BLOCKING.includes(status), status);
      }
    });

    test('respons lengkap: masa sewa, perkiraan ukuran, sizeMatch (ALL_SIZE selalu cocok), yang cocok di urutan pertama', async () => {
      ml.reply = () => [200, estimate('L')];
      const res = await api('GET', `/kebaya/available?useDate=${U}&ld=97&tb=160.5&bb=60`);
      assert.equal(res.status, 200);
      const item = (id, code, name, category, size, sizeMatch) => ({
        id,
        code,
        name,
        category,
        size,
        photoUrl: photoUrl(id),
        sizeMatch,
      });
      assert.deepEqual(res.body, {
        status: 'success',
        message: 'Ditemukan 4 kebaya tersedia',
        data: {
          useDate: U,
          rentalPeriod: { start: at(-1), end: at(3) },
          sizeEstimate: { available: true, size: 'L', inRange: true, message: 'Perkiraan ukuran L berdasarkan tabel ukuran' },
          kebaya: [
            item(kb.L, 'KB-003', 'Kebaya Brokat Merah', 'kebaya', 'L', true),
            item(kb.ALL, 'KB-004', 'Kemeja Couple Batik', 'kemeja_couple', 'ALL_SIZE', true),
            item(kb.S, 'KB-001', 'Kebaya Encim Putih', 'kebaya', 'S', false),
            item(kb.M, 'KB-002', 'Kebaya Kutubaru Hijau Sage', 'kebaya', 'M', false),
          ],
        },
      });
      // Kontrak 5: ukuran badan dikirim sebagai angka, dengan X-API-Key.
      assert.deepEqual(ml.requests, [
        { method: 'POST', url: '/v1/size-estimate', apiKey: 'test-key', body: { ld: 97, tb: 160.5, bb: 60 } },
      ]);
    });

    test('hanya kebaya aktif; filter category', async () => {
      await book({ kebayaId: kb.S, useDate: U, status: 'dp_paid' });
      assert.deepEqual(codes(await available(U)), ['KB-002', 'KB-004', 'KB-003']); // KB-005 nonaktif
      assert.deepEqual(codes(await available(U, '&category=kemeja_couple')), ['KB-004']);
      assert.deepEqual(codes(await available(U, '&category=kebaya')), ['KB-002', 'KB-003']);

      await book({ kebayaId: kb.M, useDate: U, status: 'paid_off' });
      await book({ kebayaId: kb.L, useDate: U, status: 'returned' });
      const res = await available(U, '&category=kebaya');
      assert.equal(res.status, 200);
      assert.deepEqual([res.body.message, res.body.data.kebaya], ['Ditemukan 0 kebaya tersedia', []]);
    });

    test('layanan model gagal, timeout, atau membalas di luar kontrak -> tetap 200, sizeMatch null', async (t) => {
      const log = t.mock.method(console, 'error', () => {});
      const failures = [
        ['error 500', () => (ml.reply = () => [500, { status: 'error', code: 'INTERNAL_ERROR', message: 'x' }])],
        ['401 (ML_API_KEY salah)', () => (ml.reply = () => [401, { status: 'fail', code: 'UNAUTHORIZED', message: 'x' }])],
        ['ukuran di luar enum kebaya', () => (ml.reply = () => [200, estimate('XS')])],
        ['tanpa tableVersion', () => (ml.reply = () => [200, { ...estimate('M'), tableVersion: undefined }])],
        ['bukan JSON', () => (ml.reply = () => [200, undefined])],
        [
          'timeout',
          () => {
            process.env.ML_TIMEOUT_MS = '100';
            ml.reply = () => 'hang';
          },
        ],
        ['tidak bisa dihubungi', () => (process.env.ML_SERVICE_URL = 'http://localhost:1')],
        ['ML_SERVICE_URL kosong', () => delete process.env.ML_SERVICE_URL],
      ];
      for (const [label, setup] of failures) {
        setup();
        const res = await available(U);
        assert.equal(res.status, 200, label);
        assert.deepEqual(res.body.data.sizeEstimate, NO_ESTIMATE, label);
        assert.deepEqual(
          res.body.data.kebaya.map((k) => [k.code, k.sizeMatch]),
          [
            ['KB-001', null],
            ['KB-002', null],
            ['KB-003', null],
            ['KB-004', null],
          ],
          label,
        );
        resetEnv();
      }
      // Kontrak 5: kegagalan dicatat di log backend, termasuk 401 yang berarti salah konfigurasi.
      assert.equal(log.mock.callCount(), failures.length);
      assert.match(log.mock.calls[1].arguments.join(' '), /401/);
    });

    test('ukuran di luar tabel -> inRange false, size null, pesan dari model, sizeMatch null', async () => {
      ml.reply = () => [200, OUT_OF_TABLE];
      const res = await available(U);
      assert.deepEqual(res.body.data.sizeEstimate, {
        available: true,
        size: null,
        inRange: false,
        message: 'Ukuran di luar tabel, silakan hubungi admin untuk fitting',
      });
      assert.ok(res.body.data.kebaya.every((k) => k.sizeMatch === null));
    });

    test('masa sewa mengikuti RENTAL_DAYS_BEFORE, RENTAL_DAYS_AFTER, LAUNDRY_DAYS', async (t) => {
      await book({ kebayaId: kb.M, useDate: at(3), status: 'dp_paid' }); // U+2 s.d. U+6
      await book({ kebayaId: kb.L, useDate: at(-4), status: 'dp_paid' }); // U−5 s.d. U−1
      assert.deepEqual(codes(await available(U)), ['KB-004', 'KB-001']); // default: U−1 s.d. U+3

      Object.assign(process.env, { RENTAL_DAYS_BEFORE: '2', RENTAL_DAYS_AFTER: '0', LAUNDRY_DAYS: '1' });
      const res = await available(U);
      assert.deepEqual(res.body.data.rentalPeriod, { start: at(-2), end: at(1) });
      assert.deepEqual(codes(res), ['KB-002', 'KB-004', 'KB-001']);

      // Nilai env yang bukan bilangan bulat >= 0 tidak boleh diam-diam menggeser masa sewa.
      t.mock.method(console, 'error', () => {});
      for (const bad of ['dua', '1.5', '-1']) {
        process.env.LAUNDRY_DAYS = bad;
        assert.equal((await available(U)).status, 500, bad);
      }
    });
  });

  describe('GET /kebaya/:id', () => {
    test('kebaya aktif -> objek Kebaya kontrak 2.1', async () => {
      const res = await api('GET', `/kebaya/${kb.M}`);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        status: 'success',
        data: {
          id: kb.M,
          code: 'KB-002',
          name: 'Kebaya Kutubaru Hijau Sage',
          category: 'kebaya',
          size: 'M',
          photoUrl: photoUrl(kb.M),
          description: null,
          isActive: true,
          createdAt: T0,
          updatedAt: T0,
        },
      });
    });

    test('kebaya nonaktif atau tidak ada -> 404 NOT_FOUND', async () => {
      for (const id of [kb.OFF, 999]) {
        const res = await api('GET', `/kebaya/${id}`);
        assert.equal(res.status, 404, String(id));
        assert.deepEqual(res.body, { status: 'fail', code: 'NOT_FOUND', message: 'Kebaya tidak ditemukan' });
      }
    });
  });

  describe('POST /bookings', () => {
    const SAVED = `SELECT kebaya_id, customer_name, customer_contact, use_date, event_purpose, ld, tb, bb, estimated_size,
                          size_table_version, status, needs_fitting, rental_start, rental_end, dp_amount, admin_note
                   FROM bookings WHERE id = $1`;

    test('pengajuan tersimpan berstatus pending dengan estimatedSize dan sizeTableVersion dari model', async () => {
      const res = await api('POST', '/bookings', form({ customerName: '  Sinta  ' }));
      assert.equal(res.status, 201);
      const { id } = res.body.data;
      assert.deepEqual(res.body, {
        status: 'success',
        message: 'Pengajuan berhasil dikirim. Admin akan meninjau pengajuan Anda.',
        data: {
          id,
          status: 'pending',
          useDate: U,
          rentalPeriod: { start: at(-1), end: at(3) },
          kebaya: { id: kb.M, code: 'KB-002', name: 'Kebaya Kutubaru Hijau Sage' },
          estimatedSize: 'M',
        },
      });
      assert.deepEqual((await db.query(SAVED, [id])).rows, [
        {
          kebaya_id: kb.M,
          customer_name: 'Sinta',
          customer_contact: '0812-0000-0000',
          use_date: U,
          event_purpose: 'wisuda',
          ld: '88.0',
          tb: '158.0',
          bb: '52.0',
          estimated_size: 'M',
          size_table_version: 'sementara-1',
          status: 'pending',
          needs_fitting: null,
          rental_start: at(-1),
          rental_end: at(3),
          dp_amount: null,
          admin_note: null,
        },
      ]);
      assert.deepEqual(ml.requests, [
        { method: 'POST', url: '/v1/size-estimate', apiKey: 'test-key', body: { ld: 88, tb: 158, bb: 52 } },
      ]);

      // Kontak opsional: kosong disimpan null.
      const noContact = await api('POST', '/bookings', form({ customerContact: '' }));
      assert.equal(noContact.status, 201);
      assert.equal((await db.query(SAVED, [noContact.body.data.id])).rows[0].customer_contact, null);
    });

    test('model gagal -> tetap tersimpan dengan estimatedSize dan sizeTableVersion null', async (t) => {
      t.mock.method(console, 'error', () => {});
      for (const [label, answer, size, version] of [
        ['error 500', [500, { status: 'error' }], null, null],
        ['ukuran di luar enum kebaya', [200, estimate('XXXL')], null, null],
        ['di luar tabel ukuran: versi tabel tetap dicatat', [200, OUT_OF_TABLE], null, 'sementara-1'],
      ]) {
        ml.reply = () => answer;
        const res = await api('POST', '/bookings', form());
        assert.equal(res.status, 201, label);
        assert.equal(res.body.data.estimatedSize, size, label);
        const { rows } = await db.query(SAVED, [res.body.data.id]);
        assert.deepEqual([rows[0].status, rows[0].estimated_size, rows[0].size_table_version], ['pending', size, version], label);
      }
    });

    test('tanggal bentrok dengan pengajuan berstatus pemblokir -> 409 KEBAYA_NOT_AVAILABLE, tidak tersimpan', async () => {
      await book({ kebayaId: kb.M, useDate: U, status: 'dp_paid' }); // U−1 s.d. U+3
      await book({ kebayaId: kb.L, useDate: U, status: 'returned' });
      const taken = (code) => ({
        status: 'fail',
        code: 'KEBAYA_NOT_AVAILABLE',
        message: `Kebaya ${code} sudah dipesan pada tanggal tersebut. Silakan pilih kebaya atau tanggal lain.`,
      });
      // Dikirim langsung lewat API, tanpa melewati daftar ketersediaan.
      for (const offset of [-4, -1, 0, 1, 2, 3, 4]) {
        const res = await api('POST', '/bookings', form({ useDate: at(offset) }));
        assert.equal(res.status, 409, `H${offset >= 0 ? '+' : ''}${offset}`);
        assert.deepEqual(res.body, taken('KB-002'));
      }
      assert.deepEqual((await api('POST', '/bookings', form({ kebayaId: kb.L }))).body, taken('KB-003'));
      assert.equal(await bookingCount(), 2);

      // Di luar masa sewa itu, kebaya lain, atau pengajuan lain yang masih pending: diterima.
      for (const extra of [{ useDate: at(-5) }, { useDate: at(5) }, { kebayaId: kb.S }]) {
        const res = await api('POST', '/bookings', form(extra));
        assert.equal(res.status, 201, JSON.stringify(extra));
      }
      await book({ kebayaId: kb.ALL, useDate: U, status: 'pending' });
      assert.equal((await api('POST', '/bookings', form({ kebayaId: kb.ALL }))).status, 201);
      assert.equal(await bookingCount(), 7);
    });

    test('kebaya nonaktif -> 409, kebaya tidak ada -> 404; tidak tersimpan', async () => {
      let res = await api('POST', '/bookings', form({ kebayaId: kb.OFF }));
      assert.equal(res.status, 409);
      assert.deepEqual(res.body, {
        status: 'fail',
        code: 'KEBAYA_NOT_AVAILABLE',
        message: 'Kebaya KB-005 sedang tidak tersedia. Silakan pilih kebaya lain.',
      });
      res = await api('POST', '/bookings', form({ kebayaId: 999 }));
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { status: 'fail', code: 'NOT_FOUND', message: 'Kebaya tidak ditemukan' });
      assert.equal(await bookingCount(), 0);
    });

    test('masa sewa yang disimpan mengikuti env saat pengajuan dibuat', async () => {
      Object.assign(process.env, { RENTAL_DAYS_BEFORE: '2', RENTAL_DAYS_AFTER: '0', LAUNDRY_DAYS: '1' });
      const res = await api('POST', '/bookings', form());
      assert.deepEqual(res.body.data.rentalPeriod, { start: at(-2), end: at(1) });
      const { rows } = await db.query(SAVED, [res.body.data.id]);
      assert.deepEqual([rows[0].rental_start, rows[0].rental_end], [at(-2), at(1)]);
    });
  });

  describe('GET /health', () => {
    test('database dan layanan model hidup -> ok', async () => {
      const res = await api('GET', '/health');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: 'success', data: { db: 'ok', mlService: 'ok' } });
      assert.deepEqual(
        ml.requests.map((r) => [r.method, r.url]),
        [['GET', '/v1/health']],
      );
    });

    test('layanan model error atau tidak membalas -> mlService "down", tetap 200', async () => {
      ml.reply = () => [503, {}];
      assert.deepEqual((await api('GET', '/health')).body.data, { db: 'ok', mlService: 'down' });
      process.env.ML_TIMEOUT_MS = '100';
      ml.reply = () => 'hang';
      const res = await api('GET', '/health');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, { db: 'ok', mlService: 'down' });
    });
  });
});
