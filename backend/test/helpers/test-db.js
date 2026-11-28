// Database PostgreSQL sekali pakai untuk tes integrasi.
//
// TEST_DATABASE_URL: server Postgres yang boleh dipakai membuat database (butuh hak CREATEDB),
// mis. postgres://postgres:postgres@localhost:5432/postgres. Database di URL itu sendiri tidak diubah:
// create() membuat database baru kebaya_test_<pid>_<waktu> dari db/schema.sql, drop() menghapusnya lagi.
// Jangan pakai DATABASE_URL di .env (Neon, data asli).
//
// Pakai:
//   const testDb = testDatabase(); // null jika TEST_DATABASE_URL kosong -> lewati tesnya
//   if (testDb) process.env.DATABASE_URL = testDb.url; // sebelum require('../src/db')
//   before(() => testDb.create());
//   after(async () => { await db.end(); await testDb.drop(); }); // tutup pool dulu: drop memutus koneksi
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const SCHEMA_PATH = path.join(__dirname, '../../db/schema.sql');

async function run(connectionString, sql) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function testDatabase() {
  const serverUrl = process.env.TEST_DATABASE_URL;
  if (!serverUrl) return null;
  const name = `kebaya_test_${process.pid}_${Date.now()}`;
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    name,
    url: url.href,
    async create() {
      await run(serverUrl, `CREATE DATABASE ${name}`);
      await run(url.href, fs.readFileSync(SCHEMA_PATH, 'utf8'));
    },
    drop: () => run(serverUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`),
  };
}

module.exports = { testDatabase };
