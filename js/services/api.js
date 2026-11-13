/*
 * services/api.js — Data Service (lapisan akses data)
 * ------------------------------------------------------------------
 * Seluruh akses data aplikasi dipusatkan di sini agar komponen Vue
 * tidak perlu tahu dari mana data berasal (prinsip separation of concerns).
 *
 * Tanggung jawab:
 *   1. loadTemplates() -> mengambil file /templates/*.html (berisi <template id="tpl-...">)
 *                          lalu menyisipkannya ke DOM sebelum Vue di-mount.
 *   2. loadState()     -> fetch JSON dummy data (data/dataBahanAjar.json), menormalisasi,
 *                          atau memakai salinan terakhir dari localStorage bila ada.
 *   3. saveState()     -> menyimpan perubahan (create/update/delete) ke localStorage
 *                          sehingga data tidak hilang saat halaman di-refresh.
 *   4. Helper          -> nomor DO otomatis, tanggal lokal, sanitasi HTML, dsb.
 */
(function (global) {
  'use strict';

  const DATA_URL = 'data/dataBahanAjar.json';
  const TEMPLATE_DIR = 'templates/';
  const STORAGE_KEY = 'sitta-ut:state:v1';

  /* ---------------------------------------------------------------
   * Utilitas umum
   * ------------------------------------------------------------- */
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  /** ID unik untuk setiap baris stok (kode MK bisa sama di UT-Daerah berbeda). */
  const uid = (prefix = 'ba') =>
    `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Gagal memuat ${url} (HTTP ${res.status})`);
    return res.text();
  }

  /* ---------------------------------------------------------------
   * 1. Template loader
   *    Setiap file template berisi <template id="tpl-xxx">…</template>.
   *    Vue 2 akan membaca template tersebut saat komponen dengan opsi
   *    `template: '#tpl-xxx'` pertama kali dirender.
   * ------------------------------------------------------------- */
  async function loadTemplates(names) {
    let host = document.getElementById('template-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'template-host';
      host.hidden = true;
      document.body.appendChild(host);
    }
    const files = await Promise.all(names.map((n) => fetchText(`${TEMPLATE_DIR}${n}.html`)));
    host.insertAdjacentHTML('beforeend', files.join('\n'));
  }

  /* ---------------------------------------------------------------
   * 2. Normalisasi data JSON
   * ------------------------------------------------------------- */
  function normalizeStok(list) {
    return (list || []).map((item) => ({
      id: item.id || uid('ba'),
      kode: String(item.kode || '').toUpperCase(),
      judul: item.judul || '',
      kategori: item.kategori || '',
      upbjj: item.upbjj || '',
      lokasiRak: item.lokasiRak || '',
      harga: Number(item.harga) || 0,
      qty: Number(item.qty) || 0,
      safety: Number(item.safety) || 0,
      catatanHTML: sanitizeHtml(item.catatanHTML || '')
    }));
  }

  /**
   * Data tracking pada JSON berbentuk Array of Object: [{ "DO2025-0001": {...} }, ...]
   * dan mengandung entri duplikat. Dinormalisasi menjadi Object map yang
   * ber-key Nomor DO -> unik & bisa diakses dengan name based index:
   *   tracking['DO2025-0001']
   */
  function normalizeTracking(list) {
    const map = {};
    const entries = Array.isArray(list) ? list : [list || {}];
    entries.forEach((entry) => {
      Object.keys(entry || {}).forEach((nomor) => {
        if (map[nomor]) return; // abaikan duplikat
        const rec = clone(entry[nomor]);
        map[nomor] = {
          nim: rec.nim || '',
          nama: rec.nama || '',
          status: rec.status || 'Diproses',
          ekspedisi: rec.ekspedisi || '',
          tanggalKirim: rec.tanggalKirim || '',
          paket: rec.paket || '',
          total: Number(rec.total) || 0,
          perjalanan: Array.isArray(rec.perjalanan) ? rec.perjalanan : []
        };
      });
    });
    return map;
  }

  function normalize(raw) {
    return {
      upbjjList: raw.upbjjList || [],
      kategoriList: raw.kategoriList || [],
      pengirimanList: raw.pengirimanList || [],
      paket: raw.paket || [],
      stok: normalizeStok(raw.stok),
      tracking: normalizeTracking(raw.tracking)
    };
  }

  /* ---------------------------------------------------------------
   * 3. State: load / save / reset (localStorage)
   * ------------------------------------------------------------- */
  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.state && Array.isArray(parsed.state.stok) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Memuat state aplikasi.
   * @param {{fresh?: boolean}} opts fresh=true -> abaikan localStorage, ambil ulang JSON.
   * @returns {Promise<{state: object, source: 'json'|'storage', savedAt: string|null}>}
   */
  async function loadState(opts = {}) {
    if (!opts.fresh) {
      const cached = readStorage();
      if (cached) return { state: normalize(cached.state), source: 'storage', savedAt: cached.savedAt };
    }
    const text = await fetchText(DATA_URL);
    return { state: normalize(JSON.parse(text)), source: 'json', savedAt: null };
  }

  function saveState(state) {
    const savedAt = nowStamp();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt, state }));
      return savedAt;
    } catch (e) {
      return null; // mode privat / storage penuh: aplikasi tetap berjalan in-memory
    }
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* abaikan */ }
  }

  /* ---------------------------------------------------------------
   * 4. Helper domain
   * ------------------------------------------------------------- */

  /** Tanggal lokal hari ini dalam format input date: YYYY-MM-DD (bukan UTC). */
  function todayISO(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Waktu lokal saat ini: YYYY-MM-DD HH:mm:ss (format sama dengan data perjalanan). */
  function nowStamp(d = new Date()) {
    return `${todayISO(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /**
   * Nomor DO otomatis = "DO" + tahun berjalan + "-" + sequence number 3 digit.
   * Sequence melanjutkan nomor urut terbesar pada data tracking:
   *   data awal DO2025-0001 (seq 1) -> DO baru = DO<tahun>-002, lalu -003, dst.
   */
  function nextDoNumber(tracking, d = new Date()) {
    const max = Object.keys(tracking || {}).reduce((acc, nomor) => {
      const m = /^DO\d{4}-(\d+)$/.exec(nomor);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 0);
    return `DO${d.getFullYear()}-${pad(max + 1, 3)}`;
  }

  /**
   * Sanitasi HTML untuk catatanHTML (ditampilkan via v-html).
   * Hanya tag format teks sederhana yang diizinkan; atribut dihapus
   * untuk mencegah XSS (mis. <img onerror=...> atau <script>).
   */
  const ALLOWED_TAGS = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SMALL', 'MARK', 'BR', 'SPAN'];
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!ALLOWED_TAGS.includes(child.tagName)) {
            child.replaceWith(doc.createTextNode(child.textContent));
            return;
          }
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
          walk(child);
        } else if (child.nodeType !== Node.TEXT_NODE) {
          child.remove();
        }
      });
    };
    walk(root);
    return root.innerHTML.trim();
  }

  global.Api = {
    loadTemplates,
    loadState,
    saveState,
    clearState,
    uid,
    clone,
    todayISO,
    nowStamp,
    nextDoNumber,
    sanitizeHtml
  };
})(window);
