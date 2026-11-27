import React, { useState } from 'react';
import { Search, Check, ArrowRight, X, ChevronLeft, Calendar, Star, Sparkles } from 'lucide-react';

// =====================================================================
// DATA KOLEKSI KEBAYA (Mock — nanti diganti Axios GET /kebaya/available)
// =====================================================================
export const KOLEKSI_KEBAYA = [
  {
    id: 1,
    code: 'KB-012',
    name: 'Kebaya Kutubaru Hijau Sage',
    category: 'kebaya',
    size: 'M',
    badge: 'WISUDA & LAMARAN',
    desc: 'Brokat halus dengan detail renda modern yang anggun dan nyaman dipakai seharian.',
    specs: 'Lingkar dada 90 cm · Tinggi referensi 160 cm',
    price: 'Rp650.000',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80',
    color: 'Hijau Sage',
    material: 'Brokat Halus + Renda',
  },
  {
    id: 2,
    code: 'KB-014',
    name: 'Kebaya Ayu Ivory',
    category: 'kebaya',
    size: 'M',
    badge: 'KOLEKSI WISUDA',
    desc: 'Warna ivory klasik berhiaskan payet mutiara elegan, pilihan favorit untuk acara wisuda.',
    specs: 'Lingkar dada 88 cm · Tinggi referensi 160 cm',
    price: 'Rp750.000',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    color: 'Ivory / Krem',
    material: 'Brokat + Payet Mutiara',
  },
  {
    id: 3,
    code: 'KB-018',
    name: 'Kebaya Kirana Rose',
    category: 'kebaya',
    size: 'S',
    badge: 'PERNIKAHAN & LAMARAN',
    desc: 'Kebaya modern nuansa rose gold dengan payet kristal mewah untuk prosesi lamaran dan bridesmaid.',
    specs: 'Lingkar dada 84 cm · Tinggi referensi 158 cm',
    price: 'Rp850.000',
    image: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=800&q=80',
    color: 'Rose Gold',
    material: 'Brokat + Payet Kristal',
  },
  {
    id: 4,
    code: 'KB-022',
    name: 'Kebaya Bali Laras Navy',
    category: 'kebaya',
    size: 'L',
    badge: 'ADAT & RESMI',
    desc: 'Kebaya model Bali anggun warna navy dengan selendang pinggang senada yang memikat.',
    specs: 'Lingkar dada 96 cm · Tinggi referensi 165 cm',
    price: 'Rp700.000',
    image: 'https://images.unsplash.com/photo-1609234656432-603f31e3f0a9?auto=format&fit=crop&w=800&q=80',
    color: 'Navy Blue',
    material: 'Brokat Bali + Selendang',
  },
  {
    id: 5,
    code: 'KB-031',
    name: 'Kebaya Modern Dusty Pink',
    category: 'kebaya',
    size: 'M',
    badge: 'WISUDA & KARTINI',
    desc: 'Kebaya kontemporer dusty pink dengan siluet ramping dan detail sulam floral di kerah.',
    specs: 'Lingkar dada 90 cm · Tinggi referensi 162 cm',
    price: 'Rp680.000',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    color: 'Dusty Pink',
    material: 'Tile + Sulam Floral',
  },
  {
    id: 6,
    code: 'KC-001',
    name: 'Kemeja Couple Batik Sage',
    category: 'kemeja_couple',
    size: 'L',
    badge: 'PASANGAN COUPLE',
    desc: 'Kemeja batik pria motif senada dengan Kebaya Kutubaru Hijau Sage untuk tampil serasi.',
    specs: 'Lingkar dada 104 cm · Panjang 72 cm',
    price: 'Rp350.000',
    image: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=800&q=80',
    color: 'Hijau Sage Batik',
    material: 'Batik Tulis Jawa',
  },
];

// =====================================================================
// HALAMAN UTAMA KATALOG
// =====================================================================
export default function CatalogPage() {
  // State halaman: 'catalog' | 'detail' | 'form' | 'success'
  const [page, setPage] = useState('catalog');
  const [selectedKebaya, setSelectedKebaya] = useState(null);

  // Filter state
  const [useDate, setUseDate] = useState('');
  const [ld, setLd] = useState('');
  const [tb, setTb] = useState('');
  const [bb, setBb] = useState('');
  const [category, setCategory] = useState('');
  const [isSearched, setIsSearched] = useState(true); // Tampil katalog langsung

  // Form pengajuan
  const [custName, setCustName] = useState('');
  const [custWa, setCustWa] = useState('');
  const [purpose, setPurpose] = useState('wisuda');
  const [catatan, setCatatan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  // Kalkulasi ukuran
  const estimatedSize = !ld ? null :
    Number(ld) <= 86 ? 'S' : Number(ld) <= 92 ? 'M' : Number(ld) <= 98 ? 'L' : 'XL';

  // Filter koleksi
  const displayedKebaya = KOLEKSI_KEBAYA.filter((k) => {
    if (category && k.category !== category) return false;
    return true;
  });

  const handleCheck = (e) => {
    e.preventDefault();
    setIsSearched(true);
  };

  const handleLihatDetail = (k) => {
    setSelectedKebaya(k);
    setPage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAjukanSewa = () => {
    setPage('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleKirimPengajuan = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulasi API POST /booking
    setTimeout(() => {
      const kode = 'AG-' + String(Math.floor(1000 + Math.random() * 9000));
      setBookingCode(kode);
      setIsSubmitting(false);
      setPage('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 800);
  };

  const handleKembaliKatalog = () => {
    setPage('catalog');
    setSelectedKebaya(null);
    setCustName('');
    setCustWa('');
    setPurpose('wisuda');
    setCatatan('');
  };

  // ================================================================
  // RENDER: HALAMAN DETAIL KEBAYA
  // ================================================================
  if (page === 'detail' && selectedKebaya) {
    const k = selectedKebaya;
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <button onClick={handleKembaliKatalog} className="hover:text-charcoal-900 transition flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            Katalog
          </button>
          <span>/</span>
          <span className="text-charcoal-800 font-semibold">{k.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Foto Besar */}
          <div className="rounded-3xl overflow-hidden border border-silk-300 bg-silk-100 aspect-[3/4] relative shadow-sm">
            <img src={k.image} alt={k.name} className="w-full h-full object-cover" />
            <span className="absolute top-4 left-4 text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Tersedia
            </span>
          </div>

          {/* Informasi Kebaya */}
          <div className="space-y-5">
            {/* Kode & Badge */}
            <div>
              <div className="text-[11px] font-semibold text-silk-700 uppercase tracking-wider mb-1">
                {k.code} · {k.badge}
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-900 leading-tight">
                {k.name}
              </h1>
            </div>

            {/* Harga */}
            <div className="bg-silk-100 rounded-2xl px-5 py-4 border border-silk-300 inline-block">
              <div className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-0.5">Harga Sewa</div>
              <div className="font-sans text-2xl font-bold text-charcoal-900 tabular-nums">{k.price} <span className="text-sm font-normal text-stone-500">/ sewa</span></div>
            </div>

            {/* Deskripsi */}
            <p className="text-sm text-stone-600 leading-relaxed">{k.desc}</p>

            {/* Info Warna & Material */}
            <div className="flex flex-wrap gap-2">
              <span className="bg-white text-stone-600 text-xs font-semibold px-4 py-1.5 rounded-full border border-silk-300">
                {k.color}
              </span>
              <span className="bg-white text-stone-600 text-xs font-semibold px-4 py-1.5 rounded-full border border-silk-300">
                {k.material}
              </span>
            </div>

            {/* Grid Ukuran & Ketersediaan */}
            <div className="bg-white rounded-2xl border border-silk-300 p-4 space-y-3">
              <div className="font-semibold text-charcoal-900 text-xs uppercase tracking-wider">
                Ukuran & Ketersediaan
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'S',  ld: '80–86 cm',   tb: '155–160 cm', available: k.size === 'S' },
                  { label: 'M',  ld: '87–92 cm',   tb: '158–165 cm', available: k.size === 'M' },
                  { label: 'L',  ld: '93–98 cm',   tb: '162–168 cm', available: k.size === 'L' },
                  { label: 'XL', ld: '99–106 cm',  tb: '165–172 cm', available: k.size === 'XL' },
                ].map((sz) => (
                  <div
                    key={sz.label}
                    className={`flex items-center justify-between rounded-xl px-4 py-2.5 border text-xs ${
                      sz.label === k.size
                        ? 'border-silk-500 bg-silk-50'
                        : 'border-silk-200 bg-white opacity-60'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-charcoal-900 text-sm mr-2">
                        {sz.label}
                      </span>
                      <span className="text-stone-500 text-[11px]">LD {sz.ld}</span>
                    </div>
                    {sz.available ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Tersedia
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-full">
                        Tidak Tersedia
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                {k.specs}
              </p>
            </div>

            {/* Tanggal pakai (opsional preview) */}
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold mb-1">ℹ️ Ketentuan Sewa</p>
              <p>Admin akan mengkonfirmasi ketersediaan. Pengajuan baru mengikat jadwal Anda.</p>
            </div>

            {/* Tombol Aksi */}
            <button
              onClick={handleAjukanSewa}
              className="w-full btn-ag-primary py-4 rounded-2xl text-sm font-bold tracking-wider uppercase flex items-center justify-center gap-2"
            >
              Ajukan Sewa <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: HALAMAN FORM PENGAJUAN
  // ================================================================
  if (page === 'form' && selectedKebaya) {
    const k = selectedKebaya;
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <button onClick={handleKembaliKatalog} className="hover:text-charcoal-900 transition flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            Katalog
          </button>
          <span>/</span>
          <button onClick={() => setPage('detail')} className="hover:text-charcoal-900 transition">{k.name}</button>
          <span>/</span>
          <span className="text-charcoal-800 font-semibold">Ajukan Sewa</span>
        </div>

        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-900">Ajukan Sewa</h1>
          <p className="text-xs text-stone-500 mt-1">Lengkapi data diri untuk dikirim ke admin butik.</p>
        </div>

        <form onSubmit={handleKirimPengajuan}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Form Data */}
            <div className="lg:col-span-7 space-y-5">
              {/* 01 Data Pelanggan */}
              <div className="bg-white rounded-3xl border border-silk-300 p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-3 border-b border-silk-200 pb-3">
                  <span className="w-7 h-7 rounded-full bg-charcoal-900 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <h2 className="font-semibold text-base text-charcoal-900 tracking-tight">Data Pelanggan</h2>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Contoh: Siti Rahmawati"
                    className="w-full text-sm px-4 py-3 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white focus:ring-1 focus:ring-silk-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">
                    Nomor WhatsApp <span className="text-stone-400 font-normal">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={custWa}
                    onChange={(e) => setCustWa(e.target.value)}
                    placeholder="Contoh: 0812-3456-7890"
                    className="w-full text-sm px-4 py-3 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Keperluan Acara *</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full text-sm px-4 py-3 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="wisuda">Wisuda</option>
                    <option value="lamaran">Lamaran</option>
                    <option value="pernikahan">Pernikahan / Bridesmaid</option>
                    <option value="kartini">Peringatan Hari Kartini / Adat</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* 02 Jadwal Penyewaan */}
              <div className="bg-white rounded-3xl border border-silk-300 p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-3 border-b border-silk-200 pb-3">
                  <span className="w-7 h-7 rounded-full bg-charcoal-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <h2 className="font-semibold text-base text-charcoal-900 tracking-tight">Jadwal Penyewaan</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Tanggal Fitting</label>
                    <input type="date" className="w-full text-sm px-3.5 py-3 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Tanggal Pakai *</label>
                    <input
                      type="date"
                      required
                      value={useDate}
                      onChange={(e) => setUseDate(e.target.value)}
                      className="w-full text-sm px-3.5 py-3 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white focus:ring-1 focus:ring-silk-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Tanggal Kembali *</label>
                    <input type="date" className="w-full text-sm px-3.5 py-3 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Catatan Tambahan</label>
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={3}
                    placeholder="Misal: perlu rok kain warna senada, ukuran lengan perlu penyesuaian, dsb."
                    className="w-full text-sm px-4 py-3 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Ringkasan & Kirim */}
            <div className="lg:col-span-5 space-y-4">
              {/* Ringkasan Busana */}
              <div className="bg-white rounded-3xl border border-silk-300 p-6 space-y-4 shadow-xs">
                <h3 className="font-semibold text-sm text-charcoal-900 border-b border-silk-200 pb-2 uppercase tracking-wider">Ringkasan Busana</h3>
                <div className="flex items-center gap-3.5">
                  <img src={k.image} alt={k.name} className="w-16 h-20 object-cover rounded-xl border border-silk-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-stone-500 font-semibold">{k.code} · Ukuran {k.size}</div>
                    <h4 className="font-serif font-bold text-base text-charcoal-900 leading-tight">{k.name}</h4>
                    <div className="mt-1 font-sans font-bold text-silk-700 text-sm tabular-nums">{k.price} / sewa</div>
                  </div>
                </div>

                {/* Rincian Harga */}
                <div className="space-y-2 text-xs text-stone-600 border-t border-silk-200 pt-3">
                  <div className="flex justify-between">
                    <span>Total Sewa</span>
                    <strong className="text-charcoal-900 font-semibold tabular-nums font-sans">{k.price}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Uang Muka (DP 50%)</span>
                    <strong className="text-silk-800 font-semibold tabular-nums font-sans">
                      Rp{(parseInt(k.price.replace(/[^0-9]/g, '')) / 2).toLocaleString('id-ID')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Sisa Pelunasan</span>
                    <strong className="text-charcoal-900 font-semibold">Dibayar saat pengambilan</strong>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-2xl p-3 text-[11px] text-amber-900 leading-relaxed border border-amber-200">
                  Pembayaran DP dilakukan setelah admin mengkonfirmasi ketersediaan busana dan jadwal fitting via WhatsApp.
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-ag-primary py-4 rounded-2xl text-sm font-bold tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>Kirim Pengajuan <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ================================================================
  // RENDER: HALAMAN SUCCESS
  // ================================================================
  if (page === 'success') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-10">
        <div className="max-w-md w-full text-center space-y-6 animate-in fade-in duration-300">
          {/* Ikon Centang */}
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-sm">
            <Check className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase font-bold text-emerald-700">Status: 201 Created</div>
            <h1 className="font-serif text-3xl font-bold text-charcoal-900">Pengajuan Berhasil!</h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              Pengajuan sewa <strong className="text-charcoal-900">{selectedKebaya?.name}</strong> sudah diterima.
              Admin akan menghubungi Anda untuk konfirmasi fitting dan pembayaran DP.
            </p>
          </div>

          {/* Detail Pengajuan */}
          <div className="bg-silk-50 rounded-2xl border border-silk-200 p-5 text-left space-y-2 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Kode Pengajuan</span>
              <strong className="text-charcoal-900 font-mono">#{bookingCode}</strong>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Nama Pemesan</span>
              <strong className="text-charcoal-900">{custName || '—'}</strong>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Keperluan</span>
              <strong className="text-charcoal-900 capitalize">{purpose}</strong>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Status</span>
              <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-xs">Menunggu</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleKembaliKatalog}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-silk-400 text-charcoal-900 hover:bg-silk-100 transition"
            >
              Kembali ke Katalog
            </button>
            <a
              href="/pengajuan-saya"
              className="flex-1 btn-ag-primary py-3 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-1.5"
            >
              Lihat Pengajuan Saya <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: HALAMAN KATALOG (DEFAULT)
  // ================================================================
  return (
    <div className="space-y-8 animate-in fade-in duration-200 py-2">
      {/* Judul */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-900">Katalog Kebaya</h1>
        <p className="text-sm text-stone-500">
          Temukan satu atau lebih koleksi kebaya untuk melengkapi penampilan istimewa Anda.
        </p>
      </div>

      {/* Form Filter */}
      <form
        onSubmit={handleCheck}
        className="bg-white p-5 sm:p-6 rounded-3xl border border-silk-300 shadow-xs space-y-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Tanggal Pemesanan</label>
            <input
              type="date"
              value={useDate}
              onChange={(e) => setUseDate(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white focus:ring-1 focus:ring-silk-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Ukuran · Tolok ukur</label>
            <div className="relative">
              <input
                type="number"
                min="60"
                max="150"
                value={ld}
                onChange={(e) => setLd(e.target.value)}
                placeholder="LD cm"
                className="w-full text-xs pl-3 pr-7 py-2.5 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white"
              />
              <span className="absolute right-2.5 top-2.5 text-[10px] text-stone-400">cm</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Tinggi Badan (TB)</label>
            <div className="relative">
              <input
                type="number"
                min="130"
                max="200"
                value={tb}
                onChange={(e) => setTb(e.target.value)}
                placeholder="TB cm"
                className="w-full text-xs pl-3 pr-7 py-2.5 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white"
              />
              <span className="absolute right-2.5 top-2.5 text-[10px] text-stone-400">cm</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Berat Badan (BB)</label>
            <div className="relative">
              <input
                type="number"
                min="30"
                max="150"
                value={bb}
                onChange={(e) => setBb(e.target.value)}
                placeholder="BB kg"
                className="w-full text-xs pl-3 pr-7 py-2.5 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white"
              />
              <span className="absolute right-2.5 top-2.5 text-[10px] text-stone-400">kg</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-800 mb-1.5">Kategori</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setIsSearched(true); }}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-silk-300 bg-silk-50/50 outline-none focus:bg-white cursor-pointer"
            >
              <option value="">Semua Kategori</option>
              <option value="kebaya">Kebaya</option>
              <option value="kemeja_couple">Kemeja Couple</option>
            </select>
          </div>
        </div>

        {/* Tombol Filter */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn-ag-primary px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase inline-flex items-center gap-2"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Cek Ketersediaan & Rekomendasi Ukuran</span>
          </button>
          {estimatedSize && (
            <span className="text-xs bg-silk-100 text-silk-800 font-semibold px-3 py-1.5 rounded-xl border border-silk-300 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Rekomendasi ukuran: <strong>{estimatedSize}</strong>
            </span>
          )}
        </div>
      </form>

      {/* Grid Koleksi — selalu tampil */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-serif text-xl font-bold text-charcoal-900">
              {displayedKebaya.length} Koleksi Tersedia
            </h2>
            {estimatedSize && (
              <p className="text-xs text-emerald-700 mt-0.5 font-semibold">
                ✓ Koleksi dengan ukuran {estimatedSize} sesuai proporsi tubuh Anda ditandai khusus
              </p>
            )}
          </div>

        </div>

        {/* Grid 3 Kolom */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedKebaya.map((k) => {
            const isMatch = estimatedSize && k.size === estimatedSize;
            return (
              <div
                key={k.id}
                className="bg-white rounded-3xl border border-silk-300 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col group"
              >
                {/* Foto */}
                <div
                  className="relative h-72 bg-silk-100 overflow-hidden cursor-pointer"
                  onClick={() => handleLihatDetail(k)}
                >
                  <img
                    src={k.image}
                    alt={k.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Badge Tersedia */}
                  <span className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                    Tersedia
                  </span>
                  {/* Badge Ukuran */}
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-md bg-white text-charcoal-900 border border-silk-300 shadow-xs">
                    Size {k.size}
                  </span>
                  {/* Badge Ukuran Cocok */}
                  {isMatch && (
                    <div className="absolute bottom-3 left-3 right-3 bg-emerald-700/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 backdrop-blur-sm">
                      <Check className="w-3.5 h-3.5" /> Ukuran Cocok untuk Anda
                    </div>
                  )}
                </div>

                {/* Konten Kartu */}
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-stone-500 mb-0.5">{k.code} · Ukuran {k.size}</div>
                    <h3 className="font-serif font-bold text-xl text-charcoal-900 leading-snug">{k.name}</h3>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">{k.desc}</p>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-silk-200">
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wider">Harga Sewa</div>
                      <div className="font-sans font-bold text-charcoal-900 tabular-nums">{k.price} <span className="text-xs font-normal text-stone-400">/ sewa</span></div>
                    </div>
                    <button
                      onClick={() => handleLihatDetail(k)}
                      className="text-xs font-semibold text-silk-700 hover:text-charcoal-900 flex items-center gap-1 transition group/btn"
                    >
                      Lihat detail
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
