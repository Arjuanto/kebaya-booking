import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-10 py-6">
      {/* Hero Section Customer */}
      <section className="bg-silk-canva border border-silk-300 rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-silk-200/80 text-silk-900 text-xs font-semibold border border-silk-300">
            <Sparkles className="w-3.5 h-3.5 text-silk-700" />
            <span>Sistem Booking Resmi & Rekomendasi Ukuran Presisi</span>
          </div>
          
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-charcoal-900 leading-tight">
            Kebaya Pilihan untuk Momen Istimewamu.
          </h1>

          <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
            Temukan koleksi kebaya anggun dari <strong>Sewa Kebaya By Ariegunarti</strong>. Dilengkapi sistem anti double-booking dan rekomendasi ukuran cerdas sesuai proporsi tubuh Anda.
          </p>

          <div className="pt-2">
            <Link
              to="/katalog"
              className="btn-ag-primary px-6 py-3.5 rounded-xl text-xs font-bold tracking-wider uppercase inline-flex items-center gap-2"
            >
              <span>Jelajahi Katalog Kebaya</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-silk-200 space-y-2 shadow-xs">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <h3 className="font-serif font-bold text-lg text-charcoal-900">Anti Double-Booking</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Penjadwalan otomatis H-1 hingga H+1 dan jeda laundry untuk menjamin busana siap pakai tepat waktu.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-silk-200 space-y-2 shadow-xs">
          <Sparkles className="w-6 h-6 text-silk-700" />
          <h3 className="font-serif font-bold text-lg text-charcoal-900">Rekomendasi Ukuran Pas</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Perkiraan ukuran pas berbasis analisis lingkar dada, tinggi badan, dan berat badan Anda.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-silk-200 space-y-2 shadow-xs">
          <ShieldCheck className="w-6 h-6 text-silk-800" />
          <h3 className="font-serif font-bold text-lg text-charcoal-900">Pemesanan Tanpa Login</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Pelanggan dapat langsung mengecek ketersediaan dan mengajukan sewa tanpa perlu registrasi akun yang rumit.
          </p>
        </div>
      </section>
    </div>
  );
}
