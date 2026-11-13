/*
 * <ba-stock-table> — Halaman Stok Bahan Ajar.
 *
 * Props  : items (state.stok), upbjj-list, kategori-list
 * Events : save({ mode, item })  -> root menambah / memperbarui data
 *          delete(item)          -> root menampilkan pop up konfirmasi lalu menghapus
 *
 * Komponen ini TIDAK memodifikasi props secara langsung (one-way data flow):
 * perubahan data dikirim ke root melalui $emit, root yang menjadi single source of truth.
 *
 * Filter & sort memakai rantai computed property:
 *   items -> filteredItems -> sortedItems
 * Computed di-cache oleh Vue: hasil hanya dihitung ulang bila dependensinya berubah,
 * sehingga mengganti urutan sort TIDAK mengulang proses filter (tidak perlu recompute).
 */
const STOCK_FILTER_DEFAULT = { q: '', upbjj: '', kategori: '', reorder: false };
const STOCK_SORT_DEFAULT = { key: 'judul', dir: 'asc' };

Vue.component('ba-stock-table', {
  template: '#tpl-stock',

  props: {
    items: { type: Array, required: true },
    upbjjList: { type: Array, required: true },
    kategoriList: { type: Array, required: true }
  },

  data() {
    return {
      filter: Object.assign({}, STOCK_FILTER_DEFAULT),
      sort: Object.assign({}, STOCK_SORT_DEFAULT),
      sortOptions: [
        { value: 'judul', label: 'Judul' },
        { value: 'qty', label: 'Jumlah Stok' },
        { value: 'harga', label: 'Harga' }
      ],
      columns: [
        { key: 'judul', label: 'Mata Kuliah', sortable: true },
        { key: 'kategori', label: 'Kategori' },
        { key: 'upbjj', label: 'UT-Daerah' },
        { key: 'lokasiRak', label: 'Lokasi Rak' },
        { key: 'harga', label: 'Harga', sortable: true, align: 'right' },
        { key: 'qty', label: 'Stok', sortable: true, align: 'right' },
        { key: 'safety', label: 'Safety', align: 'right' },
        { key: 'status', label: 'Status' }
      ],
      tooltip: { visible: false, item: null, top: 0, left: 0, placement: 'bottom' },
      form: { open: false, mode: 'create', item: null, key: 0 },
      scrollable: false,       // tabel lebih lebar dari kontainer -> tampilkan bayangan kolom Aksi
      resizeObserver: null
    };
  },

  mounted() {
    // Pantau lebar tabel (berubah saat resize jendela / tab ditampilkan / filter berubah)
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.checkScroll());
      this.resizeObserver.observe(this.$refs.wrap);
    }
  },

  beforeDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
  },

  computed: {
    /*
     * Dependent options: daftar kategori baru tersedia setelah UT-Daerah dipilih,
     * dan setiap opsi menampilkan jumlah bahan ajar pada UT-Daerah tersebut.
     */
    kategoriOptions() {
      if (!this.filter.upbjj) return [];
      return this.kategoriList.map((k) => ({
        value: k,
        count: this.items.filter((i) => i.upbjj === this.filter.upbjj && i.kategori === k).length
      }));
    },

    /* Item yang perlu re-order: stok di bawah safety ATAU stok habis */
    reorderCount() {
      return this.items.filter((i) => i.qty < i.safety || i.qty === 0).length;
    },

    filteredItems() {
      const { q, upbjj, kategori, reorder } = this.filter;
      const keyword = q.trim().toLowerCase();
      return this.items.filter((i) => {
        if (upbjj && i.upbjj !== upbjj) return false;
        if (kategori && i.kategori !== kategori) return false;
        if (reorder && !(i.qty < i.safety || i.qty === 0)) return false;
        if (keyword && !`${i.kode} ${i.judul} ${i.lokasiRak}`.toLowerCase().includes(keyword)) return false;
        return true;
      });
    },

    sortedItems() {
      const { key, dir } = this.sort;
      const factor = dir === 'asc' ? 1 : -1;
      return this.filteredItems.slice().sort((a, b) => {
        const res = typeof a[key] === 'number'
          ? a[key] - b[key]
          : String(a[key]).localeCompare(String(b[key]), 'id');
        return res * factor;
      });
    },

    totals() {
      return this.filteredItems.reduce((acc, i) => {
        acc.qty += i.qty;
        acc.nilai += i.qty * i.harga;
        return acc;
      }, { qty: 0, nilai: 0 });
    },

    activeFilterCount() {
      const f = this.filter;
      return [f.q.trim(), f.upbjj, f.kategori, f.reorder].filter(Boolean).length;
    },

    isDefaultView() {
      return this.activeFilterCount === 0
        && this.sort.key === STOCK_SORT_DEFAULT.key
        && this.sort.dir === STOCK_SORT_DEFAULT.dir;
    },

    formTitle() {
      return this.form.mode === 'edit' ? 'Edit Bahan Ajar' : 'Tambah Bahan Ajar Baru';
    },
    formSubtitle() {
      return this.form.mode === 'edit' && this.form.item
        ? `${this.form.item.kode} · ${this.form.item.upbjj}`
        : 'Lengkapi data bahan ajar untuk ditambahkan ke daftar stok.';
    }
  },

  watch: {
    /* Watcher #1: UT-Daerah berubah -> filter kategori (dependent) di-reset */
    'filter.upbjj'() {
      this.filter.kategori = '';
    },

    /* Watcher #2: mode re-order aktif -> urutkan stok terkecil terlebih dahulu */
    'filter.reorder'(on) {
      if (on) this.sort = { key: 'qty', dir: 'asc' };
    }
  },

  methods: {
    /* ----- Sort ----- */
    setSort(key) {
      if (this.sort.key === key) this.sort.dir = this.sort.dir === 'asc' ? 'desc' : 'asc';
      else this.sort = { key, dir: key === 'judul' ? 'asc' : 'desc' };
    },
    toggleDir() {
      this.sort.dir = this.sort.dir === 'asc' ? 'desc' : 'asc';
    },
    sortIcon(key) {
      if (this.sort.key !== key) return 'bi-chevron-expand';
      return this.sort.dir === 'asc' ? 'bi-sort-up' : 'bi-sort-down';
    },

    /* ----- Filter ----- */
    resetFilter() {
      this.filter = Object.assign({}, STOCK_FILTER_DEFAULT);
      this.sort = Object.assign({}, STOCK_SORT_DEFAULT);
    },
    /** Dipanggil dari root (dashboard) untuk langsung menampilkan daftar re-order */
    showReorder() {
      this.filter = Object.assign({}, STOCK_FILTER_DEFAULT, { reorder: true });
    },
    focusSearch() {
      this.$refs.search && this.$refs.search.focus();
    },
    clearSearch() {
      this.filter.q = '';
    },

    /* ----- Tooltip catatan (mouse hover pada kolom Status) ----- */
    showTip(event, item) {
      const rect = event.currentTarget.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom > 160;
      this.tooltip = {
        visible: true,
        item,
        placement: below ? 'bottom' : 'top',
        left: Math.min(rect.left, window.innerWidth - 296),
        top: below ? rect.bottom + 8 : rect.top - 8
      };
    },
    hideTip() {
      this.tooltip.visible = false;
    },

    checkScroll() {
      const el = this.$refs.wrap;
      if (el) this.scrollable = el.scrollWidth > el.clientWidth + 1;
    },

    /* ----- Bar indikator stok terhadap safety stock ----- */
    stockPct(item) {
      const target = Math.max(item.safety * 2, 1);
      return Math.min(100, Math.round((item.qty / target) * 100));
    },
    rowTone(item) {
      if (item.qty === 0) return 'danger';
      if (item.qty < item.safety) return 'warning';
      return 'success';
    },

    /* ----- CRUD ----- */
    openCreate() {
      this.form = { open: true, mode: 'create', item: null, key: this.form.key + 1 };
    },
    openEdit(item) {
      this.hideTip();
      this.form = { open: true, mode: 'edit', item, key: this.form.key + 1 };
    },
    closeForm() {
      this.form.open = false;
    },
    handleSubmit(payload) {
      this.$emit('save', payload);
      this.form.open = false;
    },
    requestDelete(item) {
      this.hideTip();
      this.$emit('delete', item);
    }
  }
});
