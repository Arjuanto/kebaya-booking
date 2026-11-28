import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Grid, LogOut } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin');

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-silk-300 px-4 sm:px-8 py-3.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand / Logo Asli Resmi UMKM */}
        <Link to={isAdminPath ? "/admin/dashboard" : "/"} className="flex items-center gap-3">
          <img
            src="/assets/logo-ag.jpg"
            alt="Logo Sewa Kebaya by Ariegunarti"
            className="w-11 h-11 rounded-xl object-contain border border-silk-300 shadow-xs bg-white p-0.5 shrink-0"
          />
          <div className="leading-tight">
            <span className="text-[9.5px] tracking-[0.25em] uppercase font-bold text-silk-700 block">
              {isAdminPath ? 'ADMIN PORTAL' : 'CUSTOMER'}
            </span>
            <span className="font-serif font-bold text-charcoal-900 text-xl leading-tight block">
              By Arie Gunarti
            </span>
          </div>
        </Link>

        {/* Navigasi: Dipisahkan Total Antara Customer & Admin */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {!isAdminPath ? (
            /* NAVIGASI KHUSUS CUSTOMER (Sesuai Desain Figma Tim) */
            <>
              <Link
                to="/"
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  location.pathname === '/'
                    ? 'btn-ag-primary text-white shadow-xs'
                    : 'text-stone-600 hover:text-charcoal-900 hover:bg-silk-100'
                }`}
              >
                Beranda
              </Link>
              <Link
                to="/katalog"
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  location.pathname === '/katalog'
                    ? 'btn-ag-primary text-white shadow-xs'
                    : 'text-stone-600 hover:text-charcoal-900 hover:bg-silk-100'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Katalog</span>
              </Link>
              <Link
                to="/pengajuan-saya"
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  location.pathname === '/pengajuan-saya'
                    ? 'btn-ag-primary text-white shadow-xs'
                    : 'text-stone-600 hover:text-charcoal-900 hover:bg-silk-100'
                }`}
              >
                <span>Pengajuan saya</span>
              </Link>
            </>
          ) : (
            /* NAVIGASI KHUSUS ADMIN */
            <>
              {location.pathname !== '/admin/login' && (
                <>
                  <Link
                    to="/admin/dashboard"
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      location.pathname === '/admin/dashboard'
                        ? 'bg-silk-200 text-charcoal-900'
                        : 'text-stone-600 hover:text-charcoal-900 hover:bg-silk-100'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/kebaya"
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      location.pathname === '/admin/kebaya'
                        ? 'bg-silk-200 text-charcoal-900'
                        : 'text-stone-600 hover:text-charcoal-900 hover:bg-silk-100'
                    }`}
                  >
                    Katalog Admin
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="ml-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 transition flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar</span>
                  </button>
                </>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
