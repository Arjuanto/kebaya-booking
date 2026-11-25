for (const name of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[name]) {
    console.error(`Variabel lingkungan ${name} belum diisi`);
    process.exit(1);
  }
}

const { createApp } = require('./app');

const port = process.env.PORT || 3000;
createApp().listen(port, () => console.log(`Backend jalan di http://localhost:${port}/api/v1`));
