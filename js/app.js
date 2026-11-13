/*
 * app.js — Inisialisasi Vue root instance (#app)
 * ------------------------------------------------------------------
 * Alur bootstrap:
 *   1. Api.loadTemplates() memuat seluruh file /templates/*.html ke DOM
 *   2. new Vue({ el: '#app' }) di-mount
 *   3. created() -> Api.loadState() mengambil data JSON (atau salinan localStorage)
 *
 * Root berperan sebagai "single source of truth":
 *   - state (stok, tracking, paket, dll.) disimpan di root dan dikirim ke komponen via props
 *   - komponen mengirim perubahan ke root via event ($emit), root yang memodifikasi state
 *   - routing antarhalaman cukup memakai tab state: 'dashboard' | 'stok' | 'tracking' | 'order'
 */
(async function bootstrap() {
  'use strict';

  const TEMPLATES = [
    'status-badge',
    'app-modal',
    'app-toast',
    'dashboard-overview',
    'stock-table',
    'stock-form',
    'do-tracking',
    'order-form',
    'theme-switcher'
  ];

  const TABS = [
    { key: 'dashboard', label: 'Ringkasan', icon: 'bi-grid-1x2', title: 'Ringkasan' },
    { key: 'stok', label: 'Stok Bahan Ajar', icon: 'bi-box-seam', title: 'Stok Bahan Ajar' },
    { key: 'tracking', label: 'Tracking DO', icon: 'bi-truck', title: 'Tracking Delivery Order' },
    { key: 'order', label: 'Pemesanan', icon: 'bi-cart-plus', title: 'Pemesanan Bahan Ajar' }
  ];

  const THEME_KEY = 'sitta-ut:theme';
  const SIDEBAR_KEY = 'sitta-ut:sidebar-collapsed';
  const MOBILE_QUERY = window.matchMedia('(max-width: 860px)'); // sama dengan breakpoint CSS
  const DARK_QUERY = window.matchMedia('(prefers-color-scheme: dark)'); // tema sistem operasi
  const boot = document.getElementById('boot');

  try {
    await Api.loadTemplates(TEMPLATES);
  } catch (err) {
    showBootError(err);
    return;
  }

  window.app = new Vue({
    el: '#app',

    data: {
      tabs: TABS,
      tab: tabFromHash() || 'dashboard',
      state: null,            // diisi setelah data JSON dimuat
      loading: true,
      error: '',
      source: '',             // 'json' | 'storage'
      savedAt: null,
      sidebarOpen: false,                     // mobile: drawer sidebar terbuka
      sidebarCollapsed: readSidebarPref(),    // desktop: sidebar diciutkan (ikon saja)
      isMobile: MOBILE_QUERY.matches,
      themePref: readThemePref(),             // pilihan pengguna: 'system' (default) | 'light' | 'dark'
      systemDark: DARK_QUERY.matches,         // apakah OS sedang memakai mode gelap
      focusDo: '',            // Nomor DO yang dibuka otomatis di halaman tracking
      persistTimer: null
    },

    computed: {
      currentTab() {
        return this.tabs.find((t) => t.key === this.tab) || this.tabs[0];
      },
      reorderCount() {
        return this.state ? this.state.stok.filter((i) => i.qty < i.safety || i.qty === 0).length : 0;
      },
      activeDoCount() {
        if (!this.state) return 0;
        return Object.values(this.state.tracking)
          .filter((d) => d.status !== 'Terkirim' && d.status !== 'Dibatalkan').length;
      },
      /* Nomor DO berikutnya dihitung dari data tracking terkini */
      nextDoNumber() {
        return this.state ? Api.nextDoNumber(this.state.tracking) : '';
      },
      todayText() {
        return Format.tanggal(Api.todayISO());
      },
      /* Tema yang benar-benar diterapkan: 'system' diterjemahkan sesuai pengaturan OS */
      theme() {
        if (this.themePref === 'system') return this.systemDark ? 'dark' : 'light';
        return this.themePref;
      },
      menuButtonLabel() {
        if (this.isMobile) return this.sidebarOpen ? 'Tutup menu' : 'Buka menu';
        return this.sidebarCollapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar';
      }
    },

    watch: {
      /* Watcher: perpindahan tab -> judul dokumen, URL hash, tutup sidebar (mobile), scroll ke atas */
      tab: {
        immediate: true,
        handler(tab) {
          const meta = this.tabs.find((t) => t.key === tab);
          document.title = `${meta ? meta.title : 'SITTA'} · SITTA UT`;
          if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
          this.sidebarOpen = false;
          window.scrollTo({ top: 0 });
        }
      },

      /* Watcher (deep): setiap perubahan state disimpan ke localStorage (debounce 300 ms) */
      state: {
        deep: true,
        handler(val, old) {
          if (!val || !old) return; // abaikan saat pertama kali dimuat
          clearTimeout(this.persistTimer);
          this.persistTimer = setTimeout(() => {
            this.savedAt = Api.saveState(this.state);
            this.source = 'storage';
          }, 300);
        }
      },

      /* Watcher: preferensi sidebar diciutkan disimpan agar tetap sama setelah refresh */
      sidebarCollapsed(val) {
        try { localStorage.setItem(SIDEBAR_KEY, val ? '1' : '0'); } catch (e) { /* abaikan */ }
      },

      /* Watcher: drawer mobile terbuka -> kunci scroll halaman di belakangnya */
      sidebarOpen(open) {
        document.body.classList.toggle('no-scroll-sidebar', open);
      },

      /* Watcher: pilihan tema disimpan ('system' = hapus pilihan manual) */
      themePref(pref) {
        try {
          if (pref === 'system') localStorage.removeItem(THEME_KEY);
          else localStorage.setItem(THEME_KEY, pref);
        } catch (e) { /* abaikan */ }
      },

      /* Watcher: tema efektif berubah (pilihan pengguna ATAU OS berganti) -> terapkan ke <html> */
      theme: {
        immediate: true,
        handler(theme) {
          document.documentElement.setAttribute('data-theme', theme);
        }
      }
    },

    methods: {
      /* ---------------- Data ---------------- */
      async loadData(fresh = false) {
        this.loading = true;
        this.error = '';
        try {
          const res = await Api.loadState({ fresh });
          this.state = res.state;
          this.source = res.source;
          this.savedAt = res.savedAt;
        } catch (err) {
          this.error = err.message || String(err);
        } finally {
          this.loading = false;
        }
      },

      async resetData() {
        const ok = await this.$refs.modal.confirm({
          title: 'Muat ulang data awal?',
          message: 'Semua perubahan (tambah, edit, hapus stok, dan DO baru) akan dihapus dan data dikembalikan ke isi file dataBahanAjar.json.',
          confirmText: 'Ya, reset data',
          variant: 'danger',
          icon: 'bi-arrow-counterclockwise'
        });
        if (!ok) return;
        Api.clearState();
        this.state = null;
        await this.loadData(true);
        this.focusDo = '';
        this.notify('info', 'Data direset', 'Data dimuat ulang dari dataBahanAjar.json.');
      },

      /* ---------------- Navigasi ---------------- */
      go(tab) {
        this.tab = tab;
      },
      showReorder() {
        this.tab = 'stok';
        this.$nextTick(() => this.$refs.stock && this.$refs.stock.showReorder());
      },
      openDo(nomor) {
        this.focusDo = '';
        this.$nextTick(() => { this.focusDo = nomor; this.tab = 'tracking'; });
      },
      /** Tombol burger: mobile -> buka/tutup drawer, desktop -> ciutkan/lebarkan sidebar */
      toggleSidebar() {
        if (this.isMobile) this.sidebarOpen = !this.sidebarOpen;
        else this.sidebarCollapsed = !this.sidebarCollapsed;
      },
      onViewportChange(e) {
        this.isMobile = e.matches;
        if (!e.matches) this.sidebarOpen = false; // kembali ke desktop -> tutup drawer
      },
      /** OS berganti terang/gelap (mis. jadwal malam otomatis) -> ikut berganti bila pilihan = Sistem */
      onSystemThemeChange(e) {
        this.systemDark = e.matches;
      },

      /* ---------------- Stok: create / update / delete ---------------- */
      saveStock({ mode, item }) {
        const list = this.state.stok;
        if (mode === 'edit') {
          const idx = list.findIndex((i) => i.id === item.id);
          if (idx > -1) list.splice(idx, 1, item);
          this.notify('success', 'Perubahan disimpan', `${item.kode} · ${item.judul} berhasil diperbarui.`);
        } else {
          list.unshift(item);
          this.notify('success', 'Bahan ajar ditambahkan', `${item.kode} · ${item.judul} masuk ke daftar stok ${item.upbjj}.`);
        }
      },

      async deleteStock(item) {
        const ok = await this.$refs.modal.confirm({
          title: 'Hapus bahan ajar?',
          message: 'Data yang dihapus akan hilang dari daftar stok. Lanjutkan?',
          detail: `${item.kode} · ${item.judul} (${item.upbjj}, rak ${item.lokasiRak})`,
          confirmText: 'Ya, hapus',
          variant: 'danger',
          icon: 'bi-trash3'
        });
        if (!ok) return;
        const idx = this.state.stok.findIndex((i) => i.id === item.id);
        if (idx > -1) this.state.stok.splice(idx, 1);
        this.notify('danger', 'Bahan ajar dihapus', `${item.kode} · ${item.judul} telah dihapus.`);
      },

      /* ---------------- Delivery Order ---------------- */
      handleNewDO({ nomor, data }) {
        // $set: menambah property baru ke object reaktif (name based key) agar terdeteksi Vue 2
        this.$set(this.state.tracking, nomor, data);
        this.notify('success', 'DO berhasil dibuat', `${nomor} atas nama ${data.nama} tersimpan.`);
        this.openDo(nomor);
      },

      addProgress({ nomor, keterangan, status }) {
        const rec = this.state.tracking[nomor];
        if (!rec) return;
        rec.perjalanan.push({ waktu: Api.nowStamp(), keterangan });
        const changed = rec.status !== status;
        rec.status = status;
        this.notify('success', 'Status perjalanan ditambahkan',
          changed ? `${nomor} kini berstatus "${status}".` : `${nomor}: ${keterangan}`);
      },

      notify(type, title, message) {
        this.$refs.toast && this.$refs.toast.push({ type, title, message });
      },

      /* ---------------- Shortcut keyboard global ---------------- */
      onGlobalKeydown(e) {
        // Esc -> tutup drawer sidebar (mobile)
        if (e.key === 'Escape' && this.sidebarOpen) {
          this.sidebarOpen = false;
          return;
        }
        // Alt + 1..4 -> berpindah tab
        if (e.altKey && /^Digit[1-4]$/.test(e.code)) {
          e.preventDefault();
          this.tab = this.tabs[Number(e.code.slice(-1)) - 1].key;
          return;
        }
        // "/" -> fokus ke kolom pencarian pada halaman aktif
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        if (e.key === '/' && !typing && !document.body.classList.contains('no-scroll')) {
          const ref = this.tab === 'stok' ? this.$refs.stock : this.tab === 'tracking' ? this.$refs.tracking : null;
          if (ref) { e.preventDefault(); ref.focusSearch(); }
        }
      },
      onHashChange() {
        const tab = tabFromHash();
        if (tab && tab !== this.tab) this.tab = tab;
      }
    },

    created() {
      this.loadData();
      window.addEventListener('keydown', this.onGlobalKeydown);
      window.addEventListener('hashchange', this.onHashChange);
      MOBILE_QUERY.addEventListener('change', this.onViewportChange);
      DARK_QUERY.addEventListener('change', this.onSystemThemeChange);
    },

    mounted() {
      if (boot) boot.remove();
    },

    beforeDestroy() {
      window.removeEventListener('keydown', this.onGlobalKeydown);
      window.removeEventListener('hashchange', this.onHashChange);
      MOBILE_QUERY.removeEventListener('change', this.onViewportChange);
      DARK_QUERY.removeEventListener('change', this.onSystemThemeChange);
    }
  });

  /* ---------------- Helper ---------------- */
  function tabFromHash() {
    const key = location.hash.replace('#', '');
    return TABS.some((t) => t.key === key) ? key : '';
  }

  function readSidebarPref() {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch (e) { return false; }
  }

  /** Pilihan tema tersimpan; tidak ada pilihan manual -> 'system' (default) */
  function readThemePref() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) { /* abaikan */ }
    return 'system';
  }

  function showBootError(err) {
    const isFile = location.protocol === 'file:';
    if (!boot) return;
    boot.classList.add('boot--error');
    boot.innerHTML = `
      <div class="boot__card">
        <div class="boot__icon"><i class="bi bi-plug"></i></div>
        <h1>Aplikasi gagal dimuat</h1>
        <p>${isFile
          ? 'Halaman dibuka langsung dari file (<code>file://</code>). Browser memblokir <code>fetch()</code> untuk memuat template dan data JSON.'
          : 'Template komponen tidak dapat dimuat: ' + String(err.message || err).replace(/</g, '&lt;')}</p>
        <p>Jalankan melalui web server lokal dari folder <code>tugas3-vue-ut</code>, misalnya:</p>
        <pre>python3 -m http.server 8080</pre>
        <p>lalu buka <code>http://localhost:8080</code> — atau gunakan ekstensi <b>Live Server</b> di VS Code.</p>
      </div>`;
  }
})();
