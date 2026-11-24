// Buat atau ganti password akun admin (tidak ada endpoint registrasi).
// Pakai: npm run seed:admin -- <username> <password>
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 8) {
    console.error('Pakai: npm run seed:admin -- <username> <password minimal 8 karakter>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, username`,
    [username, hash],
  );
  console.log('Admin tersimpan:', rows[0]);
  await db.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
