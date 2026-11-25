// Pengajuan admin ke PostgreSQL sungguhan: filter, pengajuan ganda, transisi status, bentrok DP,
// DP bersamaan, dan constraint bookings_no_overlap. Dilewati jika TEST_DATABASE_URL kosong;
// lihat test/helpers/test-db.js.
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { testDatabase } = require('./helpers/test-db');

const testDb = testDatabase();
if (testDb) process.env.DATABASE_URL = testDb.url; // sebelum require src/db: pool membaca DATABASE_URL saat dibuat
process.env.JWT_SECRET = 'test-secret';
const db = require('../src/db');
const { createApp } = require('../src/app');

const token = jwt.sign({ sub: '1', username: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 60 });
const T0 = '2026-12-01T03:15:00.000Z'; // createdAt/updatedAt bawaan book()
let kb, kb2; // id KB-012 dan KB-013

// Tambah pengajuan langsung ke tabel. Masa sewa default kontrak 2.4: useDate − 1 s.d. useDate + 1 + 2.
// Kolom DP dan waktu tiap tahap diisi seperti yang diwajibkan CHECK tabel bookings.
async function book({ kebayaId = kb, useDate = '2026-12-20', status = 'pending', createdAt = T0 } = {}) {
  const { rows } = await db.query(
    `INSERT INTO bookings (kebaya_id, customer_name, customer_contact, use_date, event_purpose, ld, tb, bb,
       estimated_size, size_table_version, rental_start, rental_end, status, created_at, updated_at,
       dp_amount, dp_paid_at, paid_off_at, handed_over_at, returned_at)
     VALUES ($1, 'Sinta', '0812-0000-0000', $2, 'wisuda', 88, 158, 52, 'M', 'sementara-1',
       $2::date - 1, $2::date + 3, $3, $4, $4,
       CASE WHEN $3 NOT IN ('pending', 'rejected') THEN 50000 END,
       CASE WHEN $3 NOT IN ('pending', 'rejected') THEN $4::timestamptz END,
       CASE WHEN $3 IN ('paid_off', 'handed_over', 'returned') THEN $4::timestamptz END,
       CASE WHEN $3 IN ('handed_over', 'returned') THEN $4::timestamptz END,
       CASE WHEN $3 = 'returned' THEN $4::timestamptz END)
     RETURNING id`,
    [kebayaId, useDate, status, createdAt],
  );
  return rows[0].id;
}
// Tanggal pemakaian berjarak 10 hari, supaya masa sewanya (5 hari) tidak saling tumpang tindih.
const day = (i) => new Date(Date.UTC(2027, 0, 10 + 10 * i)).toISOString().slice(0, 10);
const statusOf = async (id) => (await db.query('SELECT status FROM bookings WHERE id = $1', [id])).rows[0].status;

// Pengajuan dari book() dalam bentuk objek Booking kontrak 2.2.
const booking = (id, extra = {}) => ({
  id,
  customerName: 'Sinta',
  customerContact: '0812-0000-0000',
  useDate: '2026-12-20',
  eventPurpose: 'wisuda',
  ld: 88,
  tb: 158,
  bb: 52,
  estimatedSize: 'M',
  sizeTableVersion: 'sementara-1',
  kebaya: { id: kb, code: 'KB-012', name: 'Kebaya Kutubaru Hijau Sage' },
  status: 'pending',
  needsFitting: null,
  rentalPeriod: { start: '2026-12-19', end: '2026-12-23' },
  dpAmount: null,
  dpPaidAt: null,
  paidOffAt: null,
  handedOverAt: null,
  returnedAt: null,
  adminNote: null,
  hasDuplicate: false,
  duplicateWith: [],
  createdAt: T0,
  updatedAt: T0,
  ...extra,
});

// Respons 409 untuk satu pengajuan yang bentrok, seperti contoh kontrak 4.
const conflict = (id, period) => ({
  status: 'fail',
  code: 'KEBAYA_NOT_AVAILABLE',
  message: `KB-012 sudah terkonfirmasi DP untuk pengajuan #${id} pada ${period}. DP tidak dapat dicatat.`,
  data: { conflictWith: [id] },
});

// Tunggu sampai n koneksi tertahan lock di database tes, supaya urutan request bisa diatur.
async function waitForLockWaiters(n) {
  for (let i = 0; i < 250; i++) {
    const { rows } = await db.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
    );
    if (rows[0].n >= n) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`Tidak ada ${n} koneksi yang menunggu lock`);
}

describe('pengajuan admin dengan PostgreSQL', { skip: !testDb && 'TEST_DATABASE_URL kosong' }, () => {
  let server, base;
  before(async () => {
    await testDb.create();
    // Pengaman: TRUNCATE di bawah hanya boleh mengenai database tes.
    assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name, testDb.name);
    server = createApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://localhost:${server.address().port}/api/v1/admin/bookings`;
  });
  after(async () => {
    server?.close();
    await db.end();
    await testDb.drop();
  });

  beforeEach(async () => {
    const [, { rows }] = await db.query(`
      TRUNCATE bookings, kebaya RESTART IDENTITY;
      INSERT INTO kebaya (code, name, category, size, photo_url) VALUES
        ('KB-012', 'Kebaya Kutubaru Hijau Sage', 'kebaya', 'M', 'https://img.example/kb-012.jpg'),
        ('KB-013', 'Kebaya Encim Putih', 'kebaya', 'S', 'https://img.example/kb-013.jpg')
      RETURNING id`);
    [kb, kb2] = rows.map((r) => r.id);
  });

  const api = async (method, path = '', body) => {
    const res = await fetch(base + path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  test('GET detail -> objek Booking lengkap (kontrak 2.2)', async () => {
    const id = await book();
    const res = await api('GET', `/${id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'success', data: booking(id) });
  });

  test('GET detail / PATCH pada pengajuan yang tidak ada -> 404 NOT_FOUND', async () => {
    for (const [method, path, body] of [
      ['GET', '/999'],
      ['PATCH', '/999/fitting', { needsFitting: true }],
      ['PATCH', '/999/status', { status: 'rejected' }],
    ]) {
      const res = await api(method, path, body);
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.deepEqual(res.body, { status: 'fail', code: 'NOT_FOUND', message: 'Pengajuan tidak ditemukan' });
    }
  });

  test('GET daftar -> terbaru dulu, paginasi default 1 dan 20', async () => {
    const a = await book({ createdAt: '2026-12-01T01:00:00.000Z' });
    const b = await book({ createdAt: '2026-12-03T01:00:00.000Z', kebayaId: kb2 });
    const c = await book({ createdAt: '2026-12-02T01:00:00.000Z', useDate: day(0) });
    const res = await api('GET');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.bookings.map((x) => x.id),
      [b, c, a],
    );
    assert.deepEqual(res.body.data.pagination, { page: 1, limit: 20, total: 3 });
    assert.deepEqual(
      res.body.data.bookings[2],
      booking(a, { createdAt: '2026-12-01T01:00:00.000Z', updatedAt: '2026-12-01T01:00:00.000Z' }),
    );
  });

  test('GET daftar dengan filter status (koma), kebayaId, from/to, dan page/limit', async () => {
    const dec10 = await book({ useDate: '2026-12-10', createdAt: '2026-12-01T01:00:00Z' });
    const dec20 = await book({ useDate: '2026-12-20', status: 'dp_paid', createdAt: '2026-12-01T02:00:00Z' });
    const dec30 = await book({ useDate: '2026-12-30', status: 'returned', createdAt: '2026-12-01T03:00:00Z' });
    const other = await book({ useDate: '2026-12-20', kebayaId: kb2, status: 'rejected', createdAt: '2026-12-01T04:00:00Z' });
    const list = async (query) => {
      const res = await api('GET', query);
      assert.equal(res.status, 200, query);
      return [res.body.data.bookings.map((x) => x.id), res.body.data.pagination.total];
    };
    assert.deepEqual(await list('?status=pending,dp_paid'), [[dec20, dec10], 2]);
    assert.deepEqual(await list('?status=returned'), [[dec30], 1]);
    assert.deepEqual(await list(`?kebayaId=${kb2}`), [[other], 1]);
    assert.deepEqual(await list('?from=2026-12-10&to=2026-12-20'), [[other, dec20, dec10], 3]); // inklusif
    assert.deepEqual(await list('?from=2026-12-21'), [[dec30], 1]);
    assert.deepEqual(await list('?status=&kebayaId=&from=&to=&hasDuplicate='), [[other, dec30, dec20, dec10], 4]);
    assert.deepEqual(await list('?limit=2&page=2'), [[dec20, dec10], 4]);
    assert.deepEqual(await list('?limit=2&page=3'), [[], 4]); // halaman kosong tetap membawa total

    const res = await api('GET', '?limit=2&page=2');
    assert.deepEqual(res.body.data.pagination, { page: 2, limit: 2, total: 4 });
  });

  test('hasDuplicate / duplicateWith: antar-pending, kebaya sama, masa sewa tumpang tindih', async () => {
    const a = await book({ useDate: '2026-12-20' }); // 19–23 Des
    const a2 = await book({ useDate: '2026-12-20' });
    const b = await book({ useDate: '2026-12-24' }); // 23–27 Des: bersinggungan dengan a di tanggal 23
    const c = await book({ useDate: '2026-12-29' }); // 28 Des–1 Jan: tidak menyentuh b
    const otherKebaya = await book({ useDate: '2026-12-20', kebayaId: kb2 });
    const rejected = await book({ useDate: '2026-12-20', status: 'rejected' });
    const dpPaid = await book({ useDate: day(0), status: 'dp_paid' });
    const pendingVsDp = await book({ useDate: day(0) }); // bentrok dengan DP, tapi itu bukan pengajuan ganda

    const res = await api('GET');
    const flags = Object.fromEntries(res.body.data.bookings.map((x) => [x.id, [x.hasDuplicate, x.duplicateWith]]));
    assert.deepEqual(flags, {
      [a]: [true, [a2, b]],
      [a2]: [true, [a, b]],
      [b]: [true, [a, a2]],
      [c]: [false, []],
      [otherKebaya]: [false, []],
      [rejected]: [false, []],
      [dpPaid]: [false, []],
      [pendingVsDp]: [false, []],
    });

    const dup = await api('GET', '?hasDuplicate=true');
    assert.deepEqual(
      dup.body.data.bookings.map((x) => x.id),
      [b, a2, a],
    );
    assert.equal(dup.body.data.pagination.total, 3);
    assert.equal((await api('GET', '?hasDuplicate=false')).body.data.pagination.total, 5);

    const detail = await api('GET', `/${a}`);
    assert.deepEqual([detail.body.data.hasDuplicate, detail.body.data.duplicateWith], [true, [a2, b]]);
  });

  test('PATCH fitting -> 200 untuk pending dan dp_paid; adminNote tidak dikirim = tetap, kosong = dihapus', async () => {
    const id = await book();
    let res = await api('PATCH', `/${id}/fitting`, { needsFitting: true, adminNote: ' Cek lingkar pinggang saat fitting ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Data fitting berhasil disimpan');
    assert.notEqual(res.body.data.updatedAt, T0); // diisi trigger database
    assert.deepEqual(
      res.body.data,
      booking(id, { needsFitting: true, adminNote: 'Cek lingkar pinggang saat fitting', updatedAt: res.body.data.updatedAt }),
    );

    res = await api('PATCH', `/${id}/fitting`, { needsFitting: false });
    assert.deepEqual([res.body.data.needsFitting, res.body.data.adminNote], [false, 'Cek lingkar pinggang saat fitting']);
    res = await api('PATCH', `/${id}/fitting`, { needsFitting: false, adminNote: '  ' });
    assert.equal(res.body.data.adminNote, null);

    const dp = await book({ useDate: day(0), status: 'dp_paid' });
    res = await api('PATCH', `/${dp}/fitting`, { needsFitting: true, adminNote: null });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.needsFitting, true);
  });

  test('PATCH fitting selain pending/dp_paid -> 409 INVALID_STATUS_TRANSITION, data tidak berubah', async () => {
    for (const [i, status] of ['rejected', 'paid_off', 'handed_over', 'returned', 'cancelled'].entries()) {
      const id = await book({ status, useDate: day(i) });
      const res = await api('PATCH', `/${id}/fitting`, { needsFitting: true, adminNote: 'x' });
      assert.equal(res.status, 409, status);
      assert.deepEqual(res.body, {
        status: 'fail',
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Data fitting hanya dapat diubah untuk pengajuan berstatus Menunggu atau DP tercatat',
      });
    }
    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM bookings WHERE needs_fitting IS NOT NULL OR admin_note IS NOT NULL',
    );
    assert.equal(rows[0].n, 0);
  });

  test('PATCH status alur lengkap pending -> dp_paid -> paid_off -> handed_over -> returned', async () => {
    const id = await book();
    const start = Date.now() - 1000;
    let res = await api('PATCH', `/${id}/status`, { status: 'dp_paid', dpAmount: 50000 });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Status pengajuan berhasil diubah');
    const { dpPaidAt } = res.body.data;
    assert.ok(Date.parse(dpPaidAt) >= start, 'dpPaidAt default waktu sekarang');

    // adminNote bukan untuk paid_off, jadi diabaikan.
    res = await api('PATCH', `/${id}/status`, { status: 'paid_off', paidAt: '2026-12-15T10:00:00+07:00', adminNote: 'x' });
    assert.equal(res.status, 200);
    res = await api('PATCH', `/${id}/status`, { status: 'handed_over', at: '2026-12-19T09:00:00+07:00' });
    assert.equal(res.status, 200);
    res = await api('PATCH', `/${id}/status`, { status: 'returned' });
    assert.equal(res.status, 200);
    const { returnedAt, updatedAt } = res.body.data;
    assert.ok(Date.parse(returnedAt) >= start, 'returnedAt default waktu sekarang');
    assert.deepEqual(
      res.body.data,
      booking(id, {
        status: 'returned',
        dpAmount: 50000,
        dpPaidAt,
        paidOffAt: '2026-12-15T03:00:00.000Z',
        handedOverAt: '2026-12-19T02:00:00.000Z',
        returnedAt,
        updatedAt,
      }),
    );
  });

  test('PATCH status rejected / cancelled dengan adminNote; tanpa adminNote catatan lama tetap', async () => {
    const p = await book();
    let res = await api('PATCH', `/${p}/status`, { status: 'rejected', adminNote: 'Ukuran tidak cocok' });
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.data.status, res.body.data.adminNote], ['rejected', 'Ukuran tidak cocok']);

    const d = await book({ useDate: day(0), status: 'dp_paid' });
    await api('PATCH', `/${d}/fitting`, { needsFitting: true, adminNote: 'Fitting tanggal 5' });
    res = await api('PATCH', `/${d}/status`, { status: 'cancelled' });
    assert.equal(res.status, 200);
    assert.deepEqual(
      [res.body.data.status, res.body.data.adminNote, res.body.data.dpAmount],
      ['cancelled', 'Fitting tanggal 5', 50000],
    );
  });

  test('PATCH status di luar panah kontrak 2.3 -> 409 INVALID_STATUS_TRANSITION, status tidak berubah', async () => {
    const cases = [
      ['pending', 'paid_off'],
      ['pending', 'handed_over'],
      ['pending', 'returned'],
      ['pending', 'cancelled'],
      ['pending', 'pending'],
      ['dp_paid', 'rejected'],
      ['dp_paid', 'handed_over'],
      ['dp_paid', 'dp_paid'],
      ['paid_off', 'cancelled'],
      ['paid_off', 'returned'],
      ['handed_over', 'paid_off'],
      ['returned', 'handed_over'],
      ['rejected', 'dp_paid'],
      ['cancelled', 'dp_paid'],
    ];
    for (const [i, [from, to]] of cases.entries()) {
      const id = await book({ status: from, useDate: day(i) });
      const res = await api('PATCH', `/${id}/status`, { status: to, dpAmount: 50000 });
      assert.equal(res.status, 409, `${from} -> ${to}`);
      assert.equal(res.body.code, 'INVALID_STATUS_TRANSITION', `${from} -> ${to}`);
      assert.equal(await statusOf(id), from);
    }
    const res = await api('PATCH', `/${await book()}/status`, { status: 'returned' });
    assert.equal(res.body.message, 'Pengajuan berstatus Menunggu tidak dapat diubah menjadi Dikembalikan');
  });

  test('DP bentrok dengan pengajuan yang sudah DP -> 409 KEBAYA_NOT_AVAILABLE + conflictWith', async () => {
    const taken = await book({ useDate: '2026-12-20', status: 'dp_paid' }); // 19–23 Des
    const id = await book({ useDate: '2026-12-22' }); // 21–25 Des
    const res = await api('PATCH', `/${id}/status`, { status: 'dp_paid', dpAmount: 50000 });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, conflict(taken, '19–23 Des 2026'));
    assert.equal(await statusOf(id), 'pending');
  });

  test('DP bentrok: paid_off/handed_over/returned juga memblokir, dan semua yang bentrok disebut', async () => {
    const x = await book({ useDate: '2026-12-10', status: 'paid_off' }); // 9–13 Des
    const y = await book({ useDate: '2026-12-16', status: 'returned' }); // 15–19 Des (termasuk jeda laundry)
    const z = await book({ useDate: '2026-12-22', status: 'handed_over' }); // 21–25 Des
    const both = await book({ useDate: '2026-12-14' }); // 13–17 Des: kena x di tanggal 13 dan y
    let res = await api('PATCH', `/${both}/status`, { status: 'dp_paid', dpAmount: 50000 });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      status: 'fail',
      code: 'KEBAYA_NOT_AVAILABLE',
      message: `KB-012 sudah terkonfirmasi DP untuk pengajuan #${x} pada 9–13 Des 2026, #${y} pada 15–19 Des 2026. DP tidak dapat dicatat.`,
      data: { conflictWith: [x, y] },
    });

    const touching = await book({ useDate: '2026-12-26' }); // 25–29 Des: kena z di tanggal 25
    res = await api('PATCH', `/${touching}/status`, { status: 'dp_paid', dpAmount: 50000 });
    assert.deepEqual(res.body, conflict(z, '21–25 Des 2026'));
  });

  test('DP tidak bentrok dengan pending/rejected/cancelled, kebaya lain, atau masa sewa yang hanya berdekatan', async () => {
    await book({ useDate: '2026-12-20' });
    await book({ useDate: '2026-12-20', status: 'rejected' });
    await book({ useDate: '2026-12-20', status: 'cancelled' });
    await book({ useDate: '2026-12-20', kebayaId: kb2, status: 'dp_paid' });
    await book({ useDate: '2026-12-15', status: 'dp_paid' }); // 14–18 Des, sehari sebelum 19 Des
    const id = await book({ useDate: '2026-12-20' });
    const res = await api('PATCH', `/${id}/status`, {
      status: 'dp_paid',
      dpAmount: 50000,
      paidAt: '2026-12-02T09:00:00+07:00',
    });
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.data.status, res.body.data.dpPaidAt], ['dp_paid', '2026-12-02T02:00:00.000Z']);
  });

  test('dua pencatatan DP bersamaan untuk masa sewa yang bentrok -> hanya satu yang berhasil', async () => {
    const a = await book({ useDate: '2026-12-20' });
    const b = await book({ useDate: '2026-12-21' });
    // Tahan row lock kebaya supaya kedua request pasti menunggu bersamaan, baru dilepas.
    const holder = await db.connect();
    let requests;
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT 1 FROM kebaya WHERE id = $1 FOR UPDATE', [kb]);
      requests = [a, b].map((id) => api('PATCH', `/${id}/status`, { status: 'dp_paid', dpAmount: 50000 }));
      await waitForLockWaiters(2);
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
    const results = await Promise.all(requests);

    const ok = results.filter((r) => r.status === 200);
    const failed = results.filter((r) => r.status === 409);
    assert.equal(ok.length, 1);
    assert.equal(failed.length, 1);
    const winner = ok[0].body.data.id;
    assert.equal(failed[0].body.code, 'KEBAYA_NOT_AVAILABLE');
    assert.deepEqual(failed[0].body.data, { conflictWith: [winner] });
    const { rows } = await db.query("SELECT id FROM bookings WHERE status = 'dp_paid'");
    assert.deepEqual(
      rows.map((r) => r.id),
      [winner],
    );
  });

  test('pelanggaran constraint bookings_no_overlap (SQLSTATE 23P01) -> 409 KEBAYA_NOT_AVAILABLE yang sama', async () => {
    const a = await book({ useDate: '2026-12-20' });
    const b = await book({ useDate: '2026-12-21' });
    // Penulis lain yang tidak memakai row lock kebaya: cek di route belum melihat DP a (belum commit),
    // jadi yang menolak adalah constraint database saat UPDATE.
    const other = await db.connect();
    let request;
    try {
      await other.query('BEGIN');
      await other.query("UPDATE bookings SET status = 'dp_paid', dp_amount = 50000, dp_paid_at = now() WHERE id = $1", [a]);
      request = api('PATCH', `/${b}/status`, { status: 'dp_paid', dpAmount: 50000 });
      await waitForLockWaiters(1); // UPDATE di route menunggu transaksi ini selesai
      await other.query('COMMIT');
    } finally {
      await other.query('ROLLBACK'); // tidak berefek jika COMMIT sudah jalan
      other.release();
    }
    const res = await request;
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, conflict(a, '19–23 Des 2026'));
    assert.equal(await statusOf(b), 'pending');
  });
});
