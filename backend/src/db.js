const { Pool, types } = require('pg');

// Kolom date (use_date, rental_*) dikirim apa adanya 'YYYY-MM-DD' (kontrak bagian 1). Parser bawaan pg
// mengubahnya jadi Date jam 00:00 waktu lokal server, yang bisa bergeser sehari saat diubah ke JSON.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Koneksi menganggur yang diputus server memicu 'error' di pool; tanpa listener, proses Node mati.
pool.on('error', (err) => console.error('Koneksi database terputus', err));

module.exports = pool;
