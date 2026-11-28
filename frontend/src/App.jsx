import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Halaman Customer
import HomePage from './pages/customer/HomePage';
import CatalogPage from './pages/customer/CatalogPage';
import MyBookingsPage from './pages/customer/MyBookingsPage';

// Halaman Admin
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import KebayaAdminPage from './pages/admin/KebayaAdminPage';

import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FAF7F2]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <Routes>
          {/* Rute Halaman Customer */}
          <Route path="/" element={<HomePage />} />
          <Route path="/katalog" element={<CatalogPage />} />
          <Route path="/pengajuan-saya" element={<MyBookingsPage />} />

          {/* Rute Dasar Admin */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/kebaya" element={<KebayaAdminPage />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Fallback 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
