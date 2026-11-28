import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';
import apiClient from '../../services/api';

export default function KebayaAdminPage() {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState('');

  // Sesuai Kontrak API v0.5: Helper Kompresi & Konversi Foto ke Base64 (Maks 1200px)
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Format foto harus JPEG, PNG, atau WebP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file foto maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize canvas max 1200px sesuai rekomendasi kontrak v0.5
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL(file.type, 0.85);
        setPhotoBase64(compressedDataUrl);
        setPhotoPreview(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between border-b border-silk-200 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-900">Kelola Koleksi Kebaya</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Kerangka siap pakai untuk modul Admin Diva (Sesuai Kontrak v0.5).
          </p>
        </div>

        <Link
          to="/admin/dashboard"
          className="text-xs text-stone-600 hover:text-charcoal-900 font-semibold"
        >
          ← Kembali ke Dashboard
        </Link>
      </div>

      {/* Contoh Komponen Upload Foto Sesuai Kontrak v0.5 */}
      <div className="bg-white rounded-3xl border border-silk-300 p-6 space-y-4 max-w-xl">
        <h3 className="font-serif font-bold text-lg text-charcoal-900">
          Uji Coba Upload Foto Kebaya (Kontrak v0.5)
        </h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          Admin dapat memilih foto langsung dari file komputer/ponsel. Website otomatis mengecilkan resolusi dan mengonversinya menjadi <em>data URL base64</em> sebelum dikirim ke endpoint <code>POST /admin/kebaya</code>.
        </p>

        <div>
          <label className="block text-xs font-semibold text-charcoal-800 mb-1">
            Pilih Foto Busana (JPEG / PNG / WebP, maks 2 MB)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="w-full text-xs text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:btn-ag-primary file:cursor-pointer"
          />
        </div>

        {photoPreview && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-semibold text-charcoal-800 block">Pratinjau Foto:</span>
            <img
              src={photoPreview}
              alt="Preview"
              className="w-40 h-48 object-cover rounded-2xl border border-silk-300 shadow-xs"
            />
            <span className="text-[10px] text-emerald-700 font-semibold block">
              ✓ File berhasil dikonversi ke Base64 (Siap dikirim di body JSON)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
