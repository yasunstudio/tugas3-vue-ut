/*
 * filters.js — Global Vue Filters (formatting data teks)
 * ------------------------------------------------------------------
 * Filter dipakai di template dengan sintaks pipe:
 *   {{ item.harga | rupiah }}          -> Rp 65.000
 *   {{ item.qty | satuan }}            -> 28 buah
 *   {{ rec.tanggalKirim | tanggal }}   -> 25 Agustus 2025
 *   {{ step.waktu | waktu }}           -> 25 Agu 2025, 10:12
 *
 * Fungsi aslinya juga diekspos sebagai window.Format agar bisa dipakai
 * di dalam methods/computed (filter Vue 2 hanya tersedia di template).
 */
(function (global) {
  'use strict';

  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  /** Memecah "YYYY-MM-DD[ HH:mm:ss]" tanpa konversi zona waktu. */
  function parseLocal(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(value || ''));
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3], h: m[4], mi: m[5] };
  }

  const Format = {
    /** Angka dengan pemisah ribuan Indonesia: 1250000 -> 1.250.000 */
    angka(value) {
      return Number(value || 0).toLocaleString('id-ID');
    },

    /** Mata uang Rupiah: 65000 -> Rp 65.000 */
    rupiah(value) {
      return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
    },

    /** Menambahkan satuan: 28 -> 28 buah (satuan default "buah") */
    satuan(value, unit = 'buah') {
      return `${Number(value || 0).toLocaleString('id-ID')} ${unit}`;
    },

    /** Tanggal Indonesia: 2025-08-25 -> 25 Agustus 2025 */
    tanggal(value) {
      const p = parseLocal(value);
      return p ? `${p.d} ${BULAN[p.mo - 1]} ${p.y}` : (value || '-');
    },

    /** Tanggal + jam: 2025-08-25 10:12:20 -> 25 Agu 2025, 10:12 */
    waktu(value) {
      const p = parseLocal(value);
      if (!p) return value || '-';
      const tgl = `${p.d} ${BULAN[p.mo - 1].slice(0, 3)} ${p.y}`;
      return p.h ? `${tgl}, ${p.h}:${p.mi}` : tgl;
    },

    /** Inisial nama untuk avatar: "Rina Wulandari" -> RW */
    inisial(value) {
      return String(value || '?').trim().split(/\s+/).slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase()).join('');
    }
  };

  Object.keys(Format).forEach((name) => Vue.filter(name, Format[name]));
  global.Format = Format;
})(window);
