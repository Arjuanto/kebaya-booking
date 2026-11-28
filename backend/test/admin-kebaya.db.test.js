// Katalog admin ke PostgreSQL sungguhan: SQL, constraint unik, dan trigger updated_at.
// Dilewati jika TEST_DATABASE_URL kosong; lihat test/helpers/test-db.js.
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
// Awal file PNG sungguhan; validasi hanya melihat byte awal.
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const input = {
  code: 'KB-001',
  name: 'Kebaya Encim Putih Gading',
  category: 'kebaya',
  size: 'M',
  photo: `data:image/png;base64,${png.toString('base64')}`,
};

describe('katalog admin dengan PostgreSQL', { skip: !testDb && 'TEST_DATABASE_URL kosong' }, () => {
  let server, base, publicBase;
  before(async () => {
    await testDb.create();
    // Pengaman: TRUNCATE di bawah hanya boleh mengenai database tes.
    assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name, testDb.name);
    server = createApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://localhost:${server.address().port}/api/v1/admin/kebaya`;
    publicBase = `http://localhost:${server.address().port}/api/v1/kebaya`;
  });
  after(async () => {
    server?.close();
    await db.end();
    await testDb.drop();
  });

  // id 1-3 sesuai urutan; KB-001 nonaktif; foto JPEG 4 byte; updated_at sengaja di masa lalu.
  beforeEach(() =>
    db.query(`
      TRUNCATE kebaya RESTART IDENTITY CASCADE;
      INSERT INTO kebaya (code, name, category, size, photo, photo_type, is_active, created_at, updated_at) VALUES
        ('KB-001', 'Kebaya Encim Putih', 'kebaya', 'S', decode('ffd8ffe0', 'hex'), 'image/jpeg', false, '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z'),
        ('KB-002', 'Kebaya Kutubaru Hijau Sage', 'kebaya', 'M', decode('ffd8ffe0', 'hex'), 'image/jpeg', true, '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z'),
        ('KC-010', 'Kemeja Couple Batik 100%', 'kemeja_couple', 'ALL_SIZE', decode('ffd8ffe0', 'hex'), 'image/jpeg', true, '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z')`),
  );

  const api = (method, path = '', body) =>
    fetch(base + path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const codes = async (query) => (await (await api('GET', query)).json()).data.kebaya.map((k) => k.code);

  test('GET daftar: termasuk nonaktif, urut kode, filter isActive / category / q', async () => {
    assert.deepEqual(await codes(''), ['KB-001', 'KB-002', 'KC-010']);
    assert.deepEqual(await codes('?isActive=false'), ['KB-001']);
    assert.deepEqual(await codes('?isActive=true&category=kebaya'), ['KB-002']);
    assert.deepEqual(await codes('?category=kemeja_couple'), ['KC-010']);
    assert.deepEqual(await codes('?q=kb-00'), ['KB-001', 'KB-002']); // kode, tanpa beda huruf
    assert.deepEqual(await codes('?q=SAGE'), ['KB-002']); // nama, tanpa beda huruf
    assert.deepEqual(await codes('?q=100%25'), ['KC-010']); // % dibaca literal
    assert.deepEqual(await codes('?q=_'), []); // _ bukan wildcard
  });

  test('POST -> tersimpan lengkap dengan kode huruf besar; kode yang sudah ada (beda huruf) -> 409', async () => {
    const created = await api('POST', '', { ...input, code: 'kb-020', description: '' });
    assert.equal(created.status, 201);
    const { createdAt, updatedAt, ...kebaya } = (await created.json()).data;
    assert.deepEqual(kebaya, {
      id: 4,
      code: 'KB-020',
      name: 'Kebaya Encim Putih Gading',
      category: 'kebaya',
      size: 'M',
      photoUrl: `/kebaya/4/foto?v=${Math.floor(Date.parse(updatedAt) / 1000)}`,
      description: null,
      isActive: true,
    });
    const { rows } = await db.query('SELECT photo, photo_type FROM kebaya WHERE id = 4');
    assert.deepEqual(rows[0], { photo: png, photo_type: 'image/png' });

    const dup = await api('POST', '', { ...input, code: 'kb-002' });
    assert.equal(dup.status, 409);
    assert.equal((await dup.json()).code, 'DUPLICATE_CODE');
  });

  test('ukuran XS dan XXXL lolos constraint database', async () => {
    for (const [code, size] of [['KB-030', 'XS'], ['KB-031', 'XXXL']]) {
      assert.equal((await api('POST', '', { ...input, code, size })).status, 201, size);
    }
  });

  test('PUT tanpa isActive -> status nonaktif tetap, updated_at diperbarui trigger', async () => {
    const res = await api('PUT', '/1', input);
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.equal(data.isActive, false);
    assert.equal(data.name, 'Kebaya Encim Putih Gading');
    assert.equal(data.createdAt, '2000-01-01T00:00:00.000Z');
    assert.ok(new Date(data.updatedAt) > new Date('2000-01-01T00:00:00Z'), data.updatedAt);

    const withActive = await api('PUT', '/2', { ...input, code: 'KB-002', isActive: false });
    assert.equal((await withActive.json()).data.isActive, false);
  });

  test('PUT tanpa foto -> foto lama tetap; foto bisa dibuka publik, termasuk kebaya nonaktif', async () => {
    assert.equal((await api('PUT', '/1', { ...input, photo: undefined })).status, 200);
    const foto = await fetch(`${publicBase}/1/foto`); // KB-001 nonaktif, tanpa token
    assert.equal(foto.status, 200);
    assert.equal(foto.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await foto.arrayBuffer()), Buffer.from('ffd8ffe0', 'hex'));
    assert.equal((await fetch(`${publicBase}/99/foto`)).status, 404);
  });

  test('PUT ke kode kebaya lain (beda huruf) -> 409, data tidak berubah', async () => {
    const res = await api('PUT', '/1', { ...input, code: 'kb-002' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'DUPLICATE_CODE');
    assert.equal((await db.query('SELECT name FROM kebaya WHERE id = 1')).rows[0].name, 'Kebaya Encim Putih');
  });

  test('PATCH active -> tersimpan, updated_at diperbarui', async () => {
    const res = await api('PATCH', '/1/active', { isActive: true });
    assert.equal(res.status, 200);
    const { rows } = await db.query('SELECT is_active, updated_at FROM kebaya WHERE id = 1');
    assert.equal(rows[0].is_active, true);
    assert.ok(rows[0].updated_at > new Date('2000-01-01T00:00:00Z'));
  });

  test('id tidak ada atau di luar rentang integer -> 404, bukan 500', async () => {
    for (const [method, path, body] of [
      ['GET', '/99'],
      ['GET', '/2147483648'],
      ['PUT', '/99', input],
      ['PATCH', '/99/active', { isActive: true }],
    ]) {
      assert.equal((await api(method, path, body)).status, 404, `${method} ${path}`);
    }
  });
});
