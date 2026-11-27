// Prompt ringkasan AI (kontrak 4, POST /admin/ai-summaries). Tanpa memanggil Gemini: yang dites adalah
// fakta yang dikirim ke model AI, bentuk request, dan pemeriksaan jawaban sebelum disimpan.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  prepareFacts,
  buildGeminiRequest,
  extractText,
  checkSummary,
  namaBulan,
  namaTanggal,
} = require('../src/ai/summary-prompt');

// Bentuk data mengikuti contoh kontrak 4 (GET /admin/analytics dan GET /admin/predictions).
const analyticsAsli = {
  dataSource: 'asli',
  period: { from: '2026-06-01', to: '2026-11-08' },
  topKebaya: [{ code: 'KB-012', name: 'Kebaya Kutubaru Hijau Sage', count: 18 }],
  busyPeriods: [{ label: 'Wisuda Oktober', month: '2026-10', count: 41 }],
  recommendations: ['Siapkan ukuran M dan L lebih banyak menjelang wisuda Oktober'],
  generatedAt: '2026-12-05T08:00:00+07:00',
};

const prediksiNormal = {
  targetMonth: '2026-12',
  model: { name: 'ridge', version: '1.0.0', maeValidasi: 13.5 },
  dataSource: 'asli',
  totalPredicted: 31.0,
  sizeBreakdown: 'proporsi_historis',
  note: null,
  predictions: [
    { size: 'S', predictedCount: 6.2 },
    { size: 'M', predictedCount: 14.0 },
    { size: 'L', predictedCount: 10.8 },
  ],
};

test('namaBulan dan namaTanggal menulis tanggal dalam bahasa Indonesia', () => {
  assert.equal(namaBulan('2026-12'), 'Desember 2026');
  assert.equal(namaBulan('2027-01'), 'Januari 2027');
  assert.equal(namaTanggal('2026-06-01'), '1 Juni 2026');
  assert.equal(namaTanggal('2026-11-08'), '8 November 2026');
});

test('fakta lengkap dari data asli membawa saran dan perkiraan per ukuran', () => {
  const f = prepareFacts({ analytics: analyticsAsli, prediction: prediksiNormal });
  assert.equal(f.ringkasMungkin, true);
  assert.equal(f.analisis.asalData, 'data asli pemesanan UMKM');
  assert.deepEqual(f.analisis.saranDariAnalisis, analyticsAsli.recommendations);
  // "Wisuda Oktober" sudah menyebut bulannya, jadi bulan tidak dikirim lagi.
  assert.equal(f.analisis.periodeRamai[0].bulan, undefined);
  const g = prepareFacts({ analytics: { ...analyticsAsli, busyPeriods: [{ label: 'Musim wisuda', month: '2026-10', count: 41 }] } });
  assert.equal(g.analisis.periodeRamai[0].bulan, 'Oktober 2026');
  assert.deepEqual(f.analisis.periode, { dari: '1 Juni 2026', sampai: '8 November 2026' });
  assert.equal(f.prediksi.bulan, 'Desember 2026');
  assert.equal(f.prediksi.rataRataMelesetPerMinggu, 13.5);
  assert.equal(f.prediksi.perUkuran.length, 3);
  assert.equal(f.prediksi.catatanPrediksi, undefined);
});

test('saran dari data contoh atau campuran tidak pernah dikirim ke model AI', () => {
  for (const dataSource of ['contoh', 'campuran']) {
    const f = prepareFacts({ analytics: { ...analyticsAsli, dataSource }, prediction: prediksiNormal });
    assert.equal(f.analisis.saranDariAnalisis, undefined, dataSource);
  }
});

test('prediksi tiruan diperlakukan sebagai prediksi tidak tersedia', () => {
  const f = prepareFacts({
    analytics: analyticsAsli,
    prediction: { ...prediksiNormal, sizeBreakdown: 'tiruan', dataSource: 'contoh' },
  });
  assert.ok(f.prediksi.tidakTersedia);
  assert.equal(f.prediksi.perkiraanTotalPemesanan, undefined);
});

test('sizeBreakdown tidak_tersedia: hanya total, baris TOTAL tidak dianggap ukuran', () => {
  const f = prepareFacts({
    prediction: { ...prediksiNormal, sizeBreakdown: 'tidak_tersedia', predictions: [{ size: 'TOTAL', predictedCount: 31 }] },
  });
  assert.equal(f.prediksi.perkiraanTotalPemesanan, 31);
  assert.equal(f.prediksi.perUkuran, undefined);
});

test('note dan maeValidasi null diteruskan dengan benar', () => {
  const f = prepareFacts({
    prediction: { ...prediksiNormal, note: 'Anggap sebagai gambaran kasar.', model: { name: 'ridge', version: '1.0.0', maeValidasi: null } },
  });
  assert.equal(f.prediksi.catatanPrediksi, 'Anggap sebagai gambaran kasar.');
  assert.equal(f.prediksi.rataRataMelesetPerMinggu, undefined);
});

test('tanpa analisis dan tanpa prediksi tidak ada yang bisa diringkas', () => {
  assert.equal(prepareFacts({}).ringkasMungkin, false);
  assert.equal(prepareFacts({ analytics: analyticsAsli }).ringkasMungkin, true);
  assert.equal(prepareFacts({ prediction: prediksiNormal }).ringkasMungkin, true);
});

test('request Gemini: instruksi sistem terpisah, tanpa temperature, fakta tanpa field internal', () => {
  const body = buildGeminiRequest(prepareFacts({ analytics: analyticsAsli, prediction: prediksiNormal }));
  assert.match(body.system_instruction.parts[0].text, /HANYA fakta dan angka/);
  assert.equal(body.generationConfig.temperature, undefined);
  const teks = body.contents[0].parts[0].text;
  assert.match(teks, /^DATA:\n/);
  assert.doesNotMatch(teks, /ringkasMungkin/);
  assert.match(teks, /Kebaya Kutubaru Hijau Sage/);
});

test('extractText hanya menerima jawaban yang selesai normal', () => {
  const jawab = (finishReason, parts) => ({ candidates: [{ finishReason, content: { parts } }] });
  assert.equal(extractText(jawab('STOP', [{ text: ' Halo. ' }])), 'Halo.');
  // Desimal bertitik dirapikan menjadi koma; titik akhir kalimat tidak tersentuh.
  assert.equal(extractText(jawab('STOP', [{ text: 'Sekitar 71.5 pemesanan.\nMeleset 13.5.' }])), 'Sekitar 71,5 pemesanan. Meleset 13,5.');
  assert.equal(extractText(jawab('STOP', [{ text: 'pikiran', thought: true }, { text: 'Jawaban.' }])), 'Jawaban.');
  assert.equal(extractText(jawab('MAX_TOKENS', [{ text: 'Terpotong' }])), '');
  assert.equal(extractText(jawab('SAFETY', [])), '');
  assert.equal(extractText({}), '');
});

// ---------- pemeriksaan jawaban ----------

const fLengkap = prepareFacts({ analytics: analyticsAsli, prediction: prediksiNormal });
const ringkasanBaik =
  'Berdasarkan data asli pemesanan UMKM dari 1 Juni sampai 8 November 2026, kebaya yang paling sering dipesan adalah ' +
  'Kebaya Kutubaru Hijau Sage dengan 18 pemesanan, dan periode paling ramai adalah Wisuda Oktober dengan 41 pemesanan. ' +
  'Untuk Desember 2026, jumlah pemesanan diperkirakan sekitar 31, dengan ukuran M sekitar 14, L sekitar 10,8, dan S sekitar 6,2; ' +
  'angka per ukuran dibagi dari proporsi ukuran pada data sebelumnya. ' +
  'Pada pengujian, prediksi mingguan rata-rata meleset sekitar 13,5 pemesanan per minggu. ' +
  'Dari hasil analisis, siapkan ukuran M dan L lebih banyak menjelang wisuda Oktober.';

test('ringkasan yang patuh aturan lolos pemeriksaan', () => {
  assert.deepEqual(checkSummary(ringkasanBaik, fLengkap), { ok: true, problems: [] });
});

test('angka karangan dan persentase ditolak', () => {
  const r = checkSummary(ringkasanBaik.replace('sekitar 31,', 'sekitar 45,') + ' Ini naik 20 persen.', fLengkap);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('45')));
  assert.ok(r.problems.some((p) => p.includes('persentase')));
});

test('asal data yang tidak disebut ditolak', () => {
  const r = checkSummary(ringkasanBaik.replace('data asli pemesanan UMKM', 'catatan toko'), fLengkap);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.startsWith('Asal data')));
});

test('saran ditolak bila analisis bukan data asli', () => {
  const fContoh = prepareFacts({ analytics: { ...analyticsAsli, dataSource: 'contoh' }, prediction: prediksiNormal });
  const teks = ringkasanBaik.replace('data asli pemesanan UMKM', 'data contoh buatan tim');
  const r = checkSummary(teks, fContoh);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.startsWith('Memberi saran')));
});

test('saran dari analisis harus disebut asalnya', () => {
  const teks = ringkasanBaik.replace('Dari hasil analisis, siapkan', 'Terkait hal tersebut, disarankan menyiapkan');
  const r = checkSummary(teks, fLengkap);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('berasal dari hasil analisis')));
});

test('format daftar atau markdown ditolak', () => {
  const r = checkSummary(`**Ringkasan**\n- ${ringkasanBaik}`, fLengkap);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('markdown')));
});

test('catatan gambaran kasar wajib tersampaikan', () => {
  const f = prepareFacts({ analytics: analyticsAsli, prediction: { ...prediksiNormal, note: 'Anggap sebagai gambaran kasar.' } });
  assert.ok(checkSummary(ringkasanBaik, f).problems.some((p) => p.includes('gambaran kasar')));
  const teks = ringkasanBaik.replace('Pada pengujian,', 'Angka Desember hanya gambaran kasar. Pada pengujian,');
  assert.equal(checkSummary(teks, f).ok, true);
});

test('ringkasan kosong atau terlalu pendek ditolak', () => {
  assert.equal(checkSummary('', fLengkap).ok, false);
  assert.equal(checkSummary('Data asli menunjukkan sekitar 31 pemesanan.', fLengkap).ok, false);
});
