import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="py-16 text-center space-y-4">
      <h1 className="font-serif text-5xl font-bold text-charcoal-900">404</h1>
      <h2 className="text-base font-semibold text-stone-700">Halaman Tidak Ditemukan</h2>
      <p className="text-xs text-stone-500 max-w-sm mx-auto">
        Tautan yang Anda tuju tidak tersedia atau rute belum terdaftar di aplikasi.
      </p>
      <div className="pt-2">
        <Link
          to="/"
          className="btn-ag-primary px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase inline-flex items-center gap-2"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Kembali ke Beranda</span>
        </Link>
      </div>
    </div>
  );
}
