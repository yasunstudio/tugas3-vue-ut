/*
 * <do-tracking> — Halaman Tracking Delivery Order (DO).
 *
 * Props  : data (state.tracking: Object map ber-key Nomor DO), paket, stok,
 *          focus (Nomor DO yang langsung ditampilkan, mis. setelah DO baru dibuat)
 * Events : add-progress({ nomor, keterangan, status })  -> root menambah riwayat perjalanan
 *          new-order                                     -> root berpindah ke tab Pemesanan
 *
 * Keyboard:
 *   Enter (kolom pencarian)  -> submit pencarian
 *   Esc   (kolom pencarian)  -> clear / reset pencarian
 *   Enter (kolom keterangan) -> tambah status perjalanan
 */
const DO_STATUS_FLOW = ['Diproses', 'Dalam Perjalanan', 'Terkirim'];

Vue.component('do-tracking', {
  template: '#tpl-tracking',

  props: {
    data: { type: Object, required: true },
    paket: { type: Array, default: () => [] },
    stok: { type: Array, default: () => [] },
    focus: { type: String, default: '' }
  },

  data() {
    return {
      searchBy: 'do',          // 'do' | 'nim'
      query: '',
      submitted: '',           // kata kunci yang sudah disubmit (Enter)
      searchError: '',
      selected: '',            // Nomor DO yang sedang dibuka
      progress: { keterangan: '', status: '' },
      progressTouched: false,
      statusOptions: DO_STATUS_FLOW.concat('Dibatalkan'),
      now: Api.nowStamp(),
      clock: null
    };
  },

  computed: {
    /* Object map -> array (v-for name based index dipakai saat mengonversi key Nomor DO) */
    records() {
      return Object.keys(this.data)
        .map((nomor) => Object.assign({ nomor }, this.data[nomor]))
        .sort((a, b) => b.nomor.localeCompare(a.nomor));
    },

    results() {
      const q = this.submitted;
      if (!q) return this.records;
      if (this.searchBy === 'nim') return this.records.filter((r) => r.nim.includes(q));
      return this.records.filter((r) => r.nomor.toUpperCase().includes(q.toUpperCase()));
    },

    stats() {
      return {
        total: this.records.length,
        jalan: this.records.filter((r) => r.status === 'Dalam Perjalanan').length,
        selesai: this.records.filter((r) => r.status === 'Terkirim').length
      };
    },

    placeholder() {
      return this.searchBy === 'do' ? 'Ketik Nomor DO, mis. DO2025-0001' : 'Ketik NIM, mis. 123456789';
    },

    selectedRecord() {
      const rec = this.data[this.selected];
      return rec ? Object.assign({ nomor: this.selected }, rec) : null;
    },

    selectedPaket() {
      if (!this.selectedRecord) return null;
      return this.paket.find((p) => p.kode === this.selectedRecord.paket) || null;
    },

    /* Isi paket: kode MK dipasangkan dengan judul dari data stok */
    paketItems() {
      if (!this.selectedPaket) return [];
      return this.selectedPaket.isi.map((kode) => {
        const found = this.stok.find((s) => s.kode === kode);
        return { kode, judul: found ? found.judul : '(tidak ada di data stok)' };
      });
    },

    /* Informasi DO sebagai Object -> dirender dengan v-for (value, label) name based index */
    detailFields() {
      const r = this.selectedRecord;
      if (!r) return {};
      return {
        'NIM': r.nim,
        'Nama Mahasiswa': r.nama,
        'Ekspedisi': r.ekspedisi,
        'Tanggal Kirim': Format.tanggal(r.tanggalKirim),
        'Paket Bahan Ajar': this.selectedPaket ? `${this.selectedPaket.kode} · ${this.selectedPaket.nama}` : r.paket,
        'Total Harga': Format.rupiah(r.total)
      };
    },

    /* Riwayat perjalanan, terbaru di atas */
    timeline() {
      return this.selectedRecord ? this.selectedRecord.perjalanan.slice().reverse() : [];
    },

    stepIndex() {
      return this.selectedRecord ? DO_STATUS_FLOW.indexOf(this.selectedRecord.status) : -1;
    },

    steps() { return DO_STATUS_FLOW; },

    progressError() {
      const k = this.progress.keterangan.trim();
      if (!k) return 'Keterangan perjalanan wajib diisi.';
      if (k.length < 5) return 'Keterangan minimal 5 karakter.';
      if (k.length > 120) return 'Keterangan maksimal 120 karakter.';
      return '';
    }
  },

  watch: {
    /* Watcher: DO baru dibuat di tab Pemesanan -> langsung dibuka di sini */
    focus: {
      immediate: true,
      handler(nomor) {
        if (!nomor) return;
        this.query = '';
        this.submitted = '';
        this.selected = nomor;
      }
    },

    /* Watcher: kolom pencarian dikosongkan -> hasil pencarian otomatis di-reset */
    query(val) {
      this.searchError = '';
      if (!val.trim()) this.submitted = '';
    },

    /* Watcher: kriteria pencarian diganti -> jalankan ulang pencarian aktif */
    searchBy() {
      if (this.submitted) this.submitSearch();
      else this.searchError = '';
    },

    /* Watcher: DO lain dipilih -> form progress dikosongkan, status mengikuti DO terpilih */
    selected() {
      this.progress = { keterangan: '', status: this.selectedRecord ? this.selectedRecord.status : '' };
      this.progressTouched = false;
    }
  },

  methods: {
    submitSearch() {
      const q = this.query.trim();
      if (!q) {
        this.searchError = 'Masukkan Nomor DO atau NIM terlebih dahulu.';
        return;
      }
      if (this.searchBy === 'nim' && !/^\d+$/.test(q)) {
        this.searchError = 'NIM hanya berisi angka.';
        return;
      }
      this.searchError = '';
      this.submitted = q;
      // Jika hasilnya tepat satu, langsung tampilkan detailnya
      if (this.results.length === 1) this.selected = this.results[0].nomor;
      else if (!this.results.some((r) => r.nomor === this.selected)) this.selected = '';
    },

    resetSearch() {
      this.query = '';
      this.submitted = '';
      this.searchError = '';
      this.selected = '';
      this.$refs.search && this.$refs.search.focus();
    },

    focusSearch() {
      this.$refs.search && this.$refs.search.focus();
    },

    select(nomor) {
      this.selected = nomor;
      // Layar kecil: panel detail berada di bawah daftar -> gulir otomatis ke detail
      if (window.matchMedia('(max-width: 1024px)').matches) {
        this.$nextTick(() => this.$refs.detail && this.$refs.detail.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    },

    stepState(i) {
      if (this.selectedRecord && this.selectedRecord.status === 'Dibatalkan') return 'cancel';
      if (i < this.stepIndex) return 'done';
      if (i === this.stepIndex) return 'current';
      return 'todo';
    },

    addProgress() {
      this.progressTouched = true;
      if (this.progressError || !this.selectedRecord) return;
      this.$emit('add-progress', {
        nomor: this.selectedRecord.nomor,
        keterangan: this.progress.keterangan.trim(),
        status: this.progress.status || this.selectedRecord.status
      });
      this.progress.keterangan = '';
      this.progressTouched = false;
    }
  },

  mounted() {
    // Jam lokal (Date) untuk menunjukkan waktu yang akan tercatat pada progress baru
    this.clock = setInterval(() => { this.now = Api.nowStamp(); }, 1000);
  },

  beforeDestroy() {
    clearInterval(this.clock);
  }
});
