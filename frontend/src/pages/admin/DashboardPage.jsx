import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, CalendarCheck, TrendingUp, LogOut } from 'lucide-react';
import apiClient from '../../services/api';

export default function DashboardPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-silk-200 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-900">Dashboard Admin</h1>
          <p className="text-xs text-stone-500 mt-0.5">Kelola data kebaya, pengajuan sewa, dan analisis.</p>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>

      {/* Ringkasan Navigasi Modul Admin */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/admin/kebaya"
          className="bg-white p-5 rounded-2xl border border-silk-300 hover:border-silk-500 shadow-xs transition group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-silk-100 text-silk-800 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-base text-charcoal-900 group-hover:text-silk-800 transition">
            Kelola Katalog Kebaya →
          </h3>
          <p className="text-xs text-stone-500">
            Tambah busana baru (upload foto base64 v0.5), ubah data, dan status aktif.
          </p>
        </Link>

        <div className="bg-white p-5 rounded-2xl border border-silk-200 shadow-xs space-y-2 opacity-80">
          <div className="w-10 h-10 rounded-xl bg-silk-100 text-silk-800 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-base text-charcoal-900">
            Pengajuan Sewa (Bookings)
          </h3>
          <p className="text-xs text-stone-500">
            Daftar pengajuan pelanggan, pencatatan DP, dan jadwal fitting. (Siap diimplementasikan oleh Diva).
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-silk-200 shadow-xs space-y-2 opacity-80">
          <div className="w-10 h-10 rounded-xl bg-silk-100 text-silk-800 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-base text-charcoal-900">
            Prediksi & Ringkasan AI
          </h3>
          <p className="text-xs text-stone-500">
            Hasil model estimasi permintaan bulanan dan ringkasan AI generatif.
          </p>
        </div>
      </div>
    </div>
  );
}
