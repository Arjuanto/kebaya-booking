import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-silk-200 bg-white/70 backdrop-blur-xs py-4 px-6 text-xs text-charcoal-700 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-widest uppercase font-semibold text-silk-800">
          BY_ARIEGUNARTI · CUSTOMER
        </span>
        <span className="text-[11px] text-stone-500">
          Sistem Booking Sewa Kebaya By Ariegunarti
        </span>
      </div>
    </footer>
  );
}
