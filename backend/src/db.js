const { Pool, types } = require('pg');

// Kolom date (use_date, rental_*) dikirim apa adanya 'YYYY-MM-DD' (kontrak bagian 1). Parser bawaan pg
// mengubahnya jadi Date jam 00:00 waktu lokal server, yang bisa bergeser sehari saat diubah ke JSON.
types.setTypeParser(types.builtins.DATE, (value) => value);

module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
