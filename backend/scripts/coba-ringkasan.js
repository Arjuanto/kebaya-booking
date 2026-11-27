// Uji coba prompt ringkasan AI ke Gemini sungguhan, tanpa database dan tanpa menjalankan server.
// Dipakai untuk memeriksa mutu prompt sebelum dan sesudah diubah (docs/ai-summary.md bagian 5).
//
//   node --env-file=.env scripts/coba-ringkasan.js            # semua skenario, masing-masing 1 kali
//   node --env-file=.env scripts/coba-ringkasan.js contoh 3   # skenario "contoh", 3 kali
//   node --env-file=.env scripts/coba-ringkasan.js semua 3    # semua skenario, masing-masing 3 kali
//   node --env-file=.env scripts/coba-ringkasan.js daftar-model  # model yang bisa dipakai API key ini
//
// Butuh GEMINI_API_KEY dan GEMINI_MODEL di .env. Data skenario berbentuk sama dengan kontrak 4 dan berisi
// angka contoh, bukan hasil analisis atau prediksi sungguhan.
const { prepareFacts, buildGeminiRequest, extractText, checkSummary } = require('../src/ai/summary-prompt');

const analytics = {
  dataSource: 'asli',
  period: { from: '2026-06-01', to: '2026-11-08' },
  topKebaya: [
    { code: 'KB-012', name: 'Kebaya Kutubaru Hijau Sage', count: 18 },
    { code: 'KB-007', name: 'Kebaya Brokat Maroon', count: 15 },
  ],
  busyPeriods: [{ label: 'Wisuda Oktober', month: '2026-10', count: 41 }],
  recommendations: ['Siapkan ukuran M dan L lebih banyak menjelang wisuda Oktober'],
};
const prediction = {
  targetMonth: '2026-12',
  model: { name: 'ridge', version: '1.0.0', maeValidasi: 13.5 },
  dataSource: 'asli',
  totalPredicted: 71.5,
  sizeBreakdown: 'proporsi_historis',
  note:
    'Bulan ini tidak ada di data asli UMKM, jadi angkanya bersandar pada pola bulan lain atau data contoh. ' +
    'Anggap sebagai gambaran kasar, bukan perkiraan yang bisa diandalkan.',
  predictions: [
    { size: 'S', predictedCount: 9.8 },
    { size: 'M', predictedCount: 31.5 },
    { size: 'L', predictedCount: 21.6 },
    { size: 'XL', predictedCount: 8.6 },
  ],
};

const SKENARIO = {
  asli: { analytics, prediction: { ...prediction, targetMonth: '2026-11', note: null } },
  'asli-bulan-baru': { analytics, prediction },
  contoh: { analytics: { ...analytics, dataSource: 'contoh' }, prediction },
  'prediksi-gagal': { analytics, prediction: null },
  'analisis-belum-ada': { analytics: null, prediction: { ...prediction, note: null } },
  'tanpa-ukuran': {
    analytics,
    prediction: { ...prediction, sizeBreakdown: 'tidak_tersedia', predictions: [{ size: 'TOTAL', predictedCount: 71.5 }] },
  },
};

async function panggilGemini(body) {
  const model = process.env.GEMINI_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error?.message ?? 'tanpa pesan'}`);
  return json;
}

// Kenapa Gemini berhenti dan berapa token terpakai, untuk mencari sebab jawaban kosong.
// Jika "berpikir" menghabiskan hampir semua maxOutputTokens, finishReason menjadi MAX_TOKENS.
function keterangan(json) {
  const k = json.candidates?.[0];
  const u = json.usageMetadata ?? {};
  return [
    `finishReason=${k?.finishReason ?? '-'}`,
    json.promptFeedback?.blockReason && `blockReason=${json.promptFeedback.blockReason}`,
    `token prompt=${u.promptTokenCount ?? '-'}`,
    `jawaban=${u.candidatesTokenCount ?? '-'}`,
    `berpikir=${u.thoughtsTokenCount ?? '-'}`,
  ]
    .filter(Boolean)
    .join(', ');
}

// Nama model yang mendukung generateContent untuk API key ini, untuk mengisi GEMINI_MODEL.
async function daftarModel() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error?.message ?? 'tanpa pesan'}`);
  const nama = (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  console.log(nama.join('\n') || '(tidak ada model)');
}

// Kuota gratis Gemini dibatasi per menit (gemini-3.5-flash-lite: 15 permintaan per menit saat diuji),
// jadi panggilan beruntun diberi jeda. Ubah lewat JEDA_MS di .env bila kuota modelnya berbeda.
const JEDA_MS = Number(process.env.JEDA_MS ?? 4500);
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [nama, ulang = '1'] = process.argv.slice(2);
  if (!process.env.GEMINI_API_KEY) {
    console.error('Isi GEMINI_API_KEY di backend/.env terlebih dahulu.');
    process.exit(1);
  }
  if (nama === 'daftar-model') return daftarModel();
  if (!process.env.GEMINI_MODEL) {
    console.error('Isi GEMINI_MODEL di backend/.env terlebih dahulu.');
    process.exit(1);
  }
  const daftar = nama && nama !== 'semua' ? [nama] : Object.keys(SKENARIO);
  let gagal = 0;
  console.log(`Model: ${process.env.GEMINI_MODEL}, batas waktu ${Number(process.env.AI_TIMEOUT_MS) || 20000} ms`);

  for (const s of daftar) {
    if (!SKENARIO[s]) {
      console.error(`Skenario "${s}" tidak ada. Pilihan: ${Object.keys(SKENARIO).join(', ')}`);
      process.exit(1);
    }
    const facts = prepareFacts(SKENARIO[s]);
    for (let i = 1; i <= Number(ulang); i++) {
      if (s !== daftar[0] || i > 1) await tidur(JEDA_MS);
      const mulai = Date.now();
      try {
        const json = await panggilGemini(buildGeminiRequest(facts));
        const teks = extractText(json);
        const cek = checkSummary(teks, facts);
        if (!cek.ok) gagal++;
        console.log(`\n=== ${s} #${i} (${Date.now() - mulai} ms) ${cek.ok ? 'LOLOS' : 'DITOLAK'}`);
        console.log(`  [${keterangan(json)}]`);
        console.log(teks || '(kosong: diblokir, terpotong, atau tanpa jawaban)');
        cek.problems.forEach((p) => console.log(`  - ${p}`));
      } catch (err) {
        gagal++;
        console.log(`\n=== ${s} #${i} (${Date.now() - mulai} ms) GAGAL: ${err.message}`);
      }
    }
  }
  console.log(`\nSelesai. ${gagal} jawaban ditolak atau gagal.`);
  process.exit(gagal ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
