const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';
const db = require('../src/db');
const { createApp } = require('../src/app');

// Baris tabel kebaya apa adanya dari pg: snake_case, timestamptz jadi Date.
const row = {
  id: 12,
  code: 'KB-012',
  name: 'Kebaya Kutubaru Hijau Sage',
  category: 'kebaya',
  size: 'M',
  description: 'Brokat, cocok untuk wisuda',
  is_active: true,
  created_at: new Date('2026-11-25T02:00:00Z'),
  updated_at: new Date('2026-11-25T02:00:00Z'),
};
// Baris di atas dalam bentuk objek Kebaya kontrak 2.1.
const json = {
  id: 12,
  code: 'KB-012',
  name: 'Kebaya Kutubaru Hijau Sage',
  category: 'kebaya',
  size: 'M',
  photoUrl: '/kebaya/12/foto?v=1795572000', // v = updated_at dalam detik
  description: 'Brokat, cocok untuk wisuda',
  isActive: true,
  createdAt: '2026-11-25T02:00:00.000Z',
  updatedAt: '2026-11-25T02:00:00.000Z',
};

let queries; // parameter tiap query yang dijalankan route
let reply; // jawaban database palsu untuk test yang sedang jalan
db.query = async (sql, params) => {
  queries.push(params);
  return reply();
};
beforeEach(() => {
  queries = [];
  reply = () => ({ rows: [] });
});
// Bentuk error pg saat constraint unik kebaya.code dilanggar.
const duplicateCode = () => {
  throw Object.assign(new Error('duplicate key value violates unique constraint "kebaya_code_key"'), {
    code: '23505',
    constraint: 'kebaya_code_key',
  });
};

let server, base, publicBase;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api/v1/admin/kebaya`;
  publicBase = `http://localhost:${server.address().port}/api/v1/kebaya`;
});
after(() => server.close());

const token = jwt.sign({ sub: '1', username: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 60 });
const api = (method, path = '', body, headers = { authorization: `Bearer ${token}` }) =>
  fetch(base + path, {
    method,
    headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const errorFields = async (res) => (await res.json()).errors.map((e) => e.field).sort();

// Awal file JPEG sungguhan (FF D8 FF); validasi hanya melihat byte awal, bukan seluruh gambar.
const jpeg = Buffer.from('ffd8ffe000104a464946', 'hex');
const dataUrl = (type, bytes) => `data:${type};base64,${bytes.toString('base64')}`;
const input = {
  code: ' KB-013 ',
  name: 'Kebaya Encim Putih',
  category: 'kebaya',
  size: 'S',
  photo: dataUrl('image/jpeg', jpeg),
  description: '  ',
};
// Parameter query untuk input di atas: sudah di-trim, foto jadi isi file + jenisnya, deskripsi kosong jadi null.
const inputParams = ['KB-013', 'Kebaya Encim Putih', 'kebaya', 'S', jpeg, 'image/jpeg', null];

test('semua endpoint tanpa token -> 401, database tidak disentuh', async () => {
  for (const [method, path, body] of [
    ['GET', ''],
    ['GET', '/12'],
    ['POST', '', input],
    ['PUT', '/12', input],
    ['PATCH', '/12/active', { isActive: false }],
  ]) {
    const res = await api(method, path, body, {});
    assert.equal(res.status, 401, `${method} ${path}`);
    assert.equal((await res.json()).code, 'UNAUTHORIZED');
  }
  assert.equal(queries.length, 0);
});

test('GET daftar -> semua kebaya (aktif dan nonaktif) dalam camelCase', async () => {
  reply = () => ({ rows: [row, { ...row, id: 13, code: 'KB-013', is_active: false }] });
  const res = await api('GET');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    status: 'success',
    message: 'Ditemukan 2 kebaya',
    data: {
      kebaya: [json, { ...json, id: 13, code: 'KB-013', photoUrl: '/kebaya/13/foto?v=1795572000', isActive: false }],
    },
  });
  assert.deepEqual(queries, [[null, null, null]]);
});

test('GET daftar dengan filter -> isActive jadi boolean, q di-trim', async () => {
  const res = await api('GET', '?isActive=false&category=kemeja_couple&q=%20Kutu%20');
  assert.equal(res.status, 200);
  assert.deepEqual(queries, [[false, 'kemeja_couple', 'Kutu']]);
});

test('GET daftar dengan filter kosong -> filter diabaikan', async () => {
  const res = await api('GET', '?isActive=&category=&q=%20');
  assert.equal(res.status, 200);
  assert.deepEqual(queries, [[null, null, null]]);
});

test('GET daftar dengan filter tidak valid -> 400 VALIDATION_ERROR', async () => {
  const res = await api('GET', '?isActive=mungkin&category=gaun');
  assert.equal(res.status, 400);
  assert.deepEqual(await errorFields(res), ['category', 'isActive']);
  assert.equal(queries.length, 0);
});

test('GET detail -> objek kebaya, yang nonaktif juga tampil', async () => {
  reply = () => ({ rows: [{ ...row, is_active: false }] });
  const res = await api('GET', '/12');
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, { ...json, isActive: false });
  assert.deepEqual(queries, [['12']]);
});

test('GET detail id tidak ada / bukan angka / di luar integer -> 404 NOT_FOUND', async () => {
  for (const path of ['/99', '/abc', '/99999999999']) {
    const res = await api('GET', path);
    assert.equal(res.status, 404, path);
    assert.deepEqual(await res.json(), { status: 'fail', code: 'NOT_FOUND', message: 'Kebaya tidak ditemukan' });
  }
  assert.deepEqual(queries, [['99']]); // id yang mustahil ada tidak dikirim ke database
});

test('POST valid -> 201, input dinormalisasi, isActive default true', async () => {
  reply = () => ({ rows: [row] });
  const res = await api('POST', '', input);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { status: 'success', message: 'Kebaya berhasil ditambahkan', data: json });
  assert.deepEqual(queries, [[...inputParams, true]]);
});

test('POST kode huruf kecil -> dikirim ke database dalam huruf besar', async () => {
  reply = () => ({ rows: [row] });
  const res = await api('POST', '', { ...input, code: 'kb-013' });
  assert.equal(res.status, 201);
  assert.equal(queries[0][0], 'KB-013');
});

test('POST tidak valid -> 400 per field dengan pesan bahasa Indonesia', async () => {
  const res = await api('POST', '', {
    code: 'K'.repeat(21),
    category: 'gaun',
    size: 'XS',
    photo: 'javascript:alert(1)',
    description: 'd'.repeat(501),
    isActive: 'ya',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'VALIDATION_ERROR');
  assert.deepEqual(body.errors.map((e) => e.field).sort(), [
    'category',
    'code',
    'description',
    'isActive',
    'name',
    'photo',
    'size',
  ]);
  assert.deepEqual(body.errors.find((e) => e.field === 'name'), { field: 'name', message: 'Nama wajib diisi' });
  assert.equal(queries.length, 0);
});

test('POST kode sudah dipakai -> 409 DUPLICATE_CODE', async () => {
  reply = duplicateCode;
  const res = await api('POST', '', input);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'DUPLICATE_CODE');
});

test('POST tanpa foto, bukan JPEG/PNG/WebP, atau isinya tidak cocok -> 400 field photo', async () => {
  const wrongType = 'Foto harus berupa file JPEG, PNG, atau WebP';
  for (const [photo, message] of [
    [undefined, 'Foto wajib diisi'],
    ['https://img.example/kb-013.jpg', wrongType], // URL seperti kontrak v0.4
    [dataUrl('image/gif', Buffer.from('GIF89a')), wrongType],
    [dataUrl('image/png', jpeg), wrongType], // label PNG, isinya JPEG
    [12345, wrongType],
  ]) {
    const res = await api('POST', '', { ...input, photo });
    assert.equal(res.status, 400, String(photo));
    assert.deepEqual((await res.json()).errors, [{ field: 'photo', message }], String(photo));
  }
  assert.equal(queries.length, 0);
});

test('POST foto lebih dari 2 MB -> 400; body di atas batas 3 MB juga 400 field photo', async () => {
  const big = Buffer.alloc(2 * 1024 * 1024 + 1);
  jpeg.copy(big);
  const tooBig = await api('POST', '', { ...input, photo: dataUrl('image/jpeg', big) });
  assert.equal(tooBig.status, 400);
  assert.deepEqual((await tooBig.json()).errors, [{ field: 'photo', message: 'Foto maksimal 2 MB' }]);

  const huge = await api('POST', '', { ...input, photo: `data:image/jpeg;base64,${'A'.repeat(3.5 * 1024 * 1024)}` });
  assert.equal(huge.status, 400);
  assert.deepEqual(await huge.json(), {
    status: 'fail',
    code: 'VALIDATION_ERROR',
    message: 'Data yang dikirim terlalu besar',
    errors: [{ field: 'photo', message: 'Foto maksimal 2 MB' }],
  });
  assert.equal(queries.length, 0);
});

test('POST tanpa token dengan body besar -> 401, body tidak diproses dulu', async () => {
  // Di atas batas 3 MB: kalau body dibaca sebelum token dicek, jawabannya 400 "terlalu besar".
  const huge = await api('POST', '', { ...input, photo: `data:image/jpeg;base64,${'A'.repeat(3.5 * 1024 * 1024)}` }, {});
  assert.equal(huge.status, 401);
  assert.equal((await huge.json()).code, 'UNAUTHORIZED');

  // JSON rusak di atas 100 KB: kalau body di-parse sebelum token dicek, jawabannya 400 "Format JSON tidak valid".
  const broken = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: `{${'x'.repeat(200 * 1024)}`,
  });
  assert.equal(broken.status, 401);
  assert.equal((await broken.json()).code, 'UNAUTHORIZED');
});

test('PUT valid -> 200; tanpa isActive, parameternya null (status aktif tidak diubah)', async () => {
  reply = () => ({ rows: [row] });
  const res = await api('PUT', '/12', input);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'success', message: 'Kebaya berhasil diperbarui', data: json });

  await api('PUT', '/12', { ...input, isActive: false });
  assert.deepEqual(queries, [
    [...inputParams, null, '12'],
    [...inputParams, false, '12'],
  ]);
});

test('PUT tanpa foto -> parameter foto null, jadi foto lama tetap dipakai', async () => {
  reply = () => ({ rows: [row] });
  const res = await api('PUT', '/12', { ...input, photo: undefined });
  assert.equal(res.status, 200);
  assert.deepEqual(queries, [['KB-013', 'Kebaya Encim Putih', 'kebaya', 'S', null, null, null, null, '12']]);
});

test('PUT tidak valid -> 400, id tidak ada -> 404, kode bentrok -> 409', async () => {
  const invalid = await api('PUT', '/12', { ...input, size: 'XS' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await errorFields(invalid), ['size']);

  assert.equal((await api('PUT', '/99', input)).status, 404);

  reply = duplicateCode;
  const dup = await api('PUT', '/12', input);
  assert.equal(dup.status, 409);
  assert.equal((await dup.json()).code, 'DUPLICATE_CODE');
});

test('PATCH active -> 200 dengan pesan sesuai status baru', async () => {
  reply = () => ({ rows: [{ ...row, is_active: false }] });
  const off = await api('PATCH', '/12/active', { isActive: false });
  assert.equal(off.status, 200);
  assert.deepEqual(await off.json(), {
    status: 'success',
    message: 'Kebaya berhasil dinonaktifkan',
    data: { ...json, isActive: false },
  });

  reply = () => ({ rows: [row] });
  assert.equal((await (await api('PATCH', '/12/active', { isActive: true })).json()).message, 'Kebaya berhasil diaktifkan');
  assert.deepEqual(queries, [
    [false, '12'],
    [true, '12'],
  ]);
});

test('PATCH active tanpa isActive -> 400, id tidak ada -> 404', async () => {
  const invalid = await api('PATCH', '/12/active', {});
  assert.equal(invalid.status, 400);
  assert.deepEqual(await errorFields(invalid), ['isActive']);

  assert.equal((await api('PATCH', '/99/active', { isActive: false })).status, 404);
});

test('GET /kebaya/:id/foto -> file foto tanpa token, boleh di-cache lama, nosniff', async () => {
  reply = () => ({ rows: [{ photo: jpeg, photo_type: 'image/jpeg' }] });
  const res = await fetch(`${publicBase}/12/foto`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), jpeg);
  assert.deepEqual(queries, [['12']]);
});

test('GET /kebaya/:id/foto id tidak ada / bukan angka / di luar integer -> 404 NOT_FOUND', async () => {
  for (const path of ['/99/foto', '/abc/foto', '/99999999999/foto']) {
    const res = await fetch(publicBase + path);
    assert.equal(res.status, 404, path);
    assert.deepEqual(await res.json(), { status: 'fail', code: 'NOT_FOUND', message: 'Kebaya tidak ditemukan' });
  }
  assert.deepEqual(queries, [['99']]); // id yang mustahil ada tidak dikirim ke database
});
