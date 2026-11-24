const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test-secret';
const db = require('../src/db');
const { createApp } = require('../src/app');

const hash = bcrypt.hashSync('rahasia123', 4);
db.query = async (sql, [username]) => ({ rows: username === 'admin' ? [{ id: 1, username: 'admin', password_hash: hash }] : [] });

let server, base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api/v1/auth`;
});
after(() => server.close());

const login = (body) =>
  fetch(`${base}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('login benar -> token, dan token dipakai di /me', async () => {
  const res = await login({ username: 'admin', password: 'rahasia123' });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.expiresIn, 28800);
  assert.deepEqual(data.admin, { id: 1, username: 'admin' });

  const me = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${data.token}` } });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).data.admin, { id: 1, username: 'admin' });
});

test('/me tanpa token atau token rusak -> 401', async () => {
  assert.equal((await fetch(`${base}/me`)).status, 401);
  const bad = await fetch(`${base}/me`, { headers: { authorization: 'Bearer abc.def.ghi' } });
  assert.equal(bad.status, 401);
  assert.equal((await bad.json()).code, 'UNAUTHORIZED');
});

test('input kosong -> 400 VALIDATION_ERROR per field', async () => {
  const res = await login({});
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.deepEqual(body.errors.map((e) => e.field).sort(), ['password', 'username']);
});

// Test terakhir: memakai sisa jatah gagal (validasi di atas sudah terhitung 1).
test('password salah / username tidak ada -> 401 generik, lalu 429 setelah 5 gagal', async () => {
  const wrong = await login({ username: 'admin', password: 'salah' });
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).message, 'Username atau password salah');
  const ghost = await login({ username: 'tidakada', password: 'rahasia123' });
  assert.equal((await ghost.json()).message, 'Username atau password salah');

  await login({ username: 'admin', password: 'salah' });
  await login({ username: 'admin', password: 'salah' }); // gagal ke-5
  const blocked = await login({ username: 'admin', password: 'rahasia123' });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, 'TOO_MANY_ATTEMPTS');
});
