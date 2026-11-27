import React, { useState } from 'react';
import { ArrowRight, MessageCircle, CheckCircle2, ChevronLeft, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MyBookingsPage() {
  const [view, setView] = useState('list'); // 'list' | 'detail'

  // Nanti diganti dengan data dari Axios GET /booking?phone=...
  const bookings = [];

  // ========================================================
  // LAYAR: DAFTAR PENGAJUAN — KOSONG
  // ========================================================
  if (view === 'list') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Judul */}
        <div className="space-y-1">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-900">Pengajuan saya</h1>
          <p className="text-sm text-stone-500">Pantau proses sewa hingga pengembalian kebaya.</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <button className="px-4 py-1.5 rounded-full font-semibold bg-charcoal-900 text-white">
            Aktif · 0
          </button>
          <button className="px-4 py-1.5 rounded-full font-semibold bg-white border border-silk-300 text-stone-600 hover:bg-silk-100 transition">
            Riwayat
          </button>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-3xl border border-silk-300 p-10 sm:p-16 shadow-xs flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-silk-100 border border-silk-300 flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-silk-500" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-serif font-bold text-xl text-charcoal-900">Belum ada pengajuan</h3>
            <p className="text-sm text-stone-500 max-w-xs leading-relaxed">
              Kamu belum mengajukan sewa kebaya. Jelajahi katalog dan temukan busana yang cocok.
            </p>
          </div>
          <Link
            to="/katalog"
            className="btn-ag-primary px-6 py-3 rounded-xl text-xs font-bold tracking-wider uppercase inline-flex items-center gap-2 mt-2"
          >
            <span>Jelajahi Katalog Kebaya</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Info Panduan */}
        <div className="bg-white rounded-3xl border border-silk-300 p-6 space-y-3 shadow-xs">
          <h4 className="font-serif font-bold text-base text-charcoal-900">Bagaimana cara menyewa?</h4>
          <div className="space-y-2 text-sm text-stone-600">
            <p>Pilih kebaya dari katalog dan klik <strong className="text-charcoal-800">"Lihat detail"</strong>.</p>
            <p>Isi data diri dan jadwal pemakaian, lalu kirim pengajuan.</p>
            <p>Admin akan menghubungi Anda via WhatsApp untuk konfirmasi fitting dan pembayaran DP.</p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // LAYAR: DETAIL PENGAJUAN (saat ada data dari API)
  // ========================================================
  return null;
}
