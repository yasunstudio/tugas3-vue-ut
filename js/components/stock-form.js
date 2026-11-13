/*
 * <ba-stock-form> — formulir kecil untuk CREATE / UPDATE data bahan ajar.
 *
 * Props  : mode ('create' | 'edit'), item (data yang diedit), upbjj-list, kategori-list,
 *          items (seluruh stok, untuk cek duplikasi kode per UT-Daerah)
 * Events : submit({ mode, item }), cancel
 *
 * Validasi sederhana dihitung lewat computed `errors` (otomatis ter-update
 * setiap kali form berubah), dan pesan error baru ditampilkan setelah field
 * disentuh (blur) atau setelah pengguna mencoba menyimpan.
 *
 * Keyboard: Enter -> langsung simpan (pada textarea gunakan Ctrl/⌘ + Enter).
 */
const STOCK_FORM_EMPTY = {
  id: null,
  kode: '',
  judul: '',
  kategori: '',
  upbjj: '',
  lokasiRak: '',
  harga: '',
  qty: '',
  safety: '',
  catatanHTML: ''
};

Vue.component('ba-stock-form', {
  template: '#tpl-stock-form',

  props: {
    mode: { type: String, default: 'create' },
    item: { type: Object, default: null },
    upbjjList: { type: Array, required: true },
    kategoriList: { type: Array, required: true },
    items: { type: Array, default: () => [] }
  },

  data() {
    return {
      // Salinan data (bukan referensi) agar perubahan baru diterapkan setelah disimpan
      form: Object.assign({}, STOCK_FORM_EMPTY, this.item ? Api.clone(this.item) : {}),
      touched: {},
      submitted: false
    };
  },

  computed: {
    isEdit() { return this.mode === 'edit'; },

    isDuplicate() {
      const f = this.form;
      return this.items.some((it) => it.kode === f.kode && it.upbjj === f.upbjj && it.id !== f.id);
    },

    /** Validasi setiap data field -> { field: 'pesan error' } */
    errors() {
      const f = this.form;
      const e = {};
      const isInt = (v) => v !== '' && v !== null && Number.isInteger(Number(v));

      if (!f.kode) e.kode = 'Kode mata kuliah wajib diisi.';
      else if (!/^[A-Z]{2,6}\d{3,5}$/.test(f.kode)) e.kode = 'Format: 2–6 huruf + 3–5 angka, mis. EKMA4116.';
      else if (f.upbjj && this.isDuplicate) e.kode = `${f.kode} sudah terdaftar di UT-Daerah ${f.upbjj}.`;

      if (!f.judul.trim()) e.judul = 'Judul mata kuliah wajib diisi.';
      else if (f.judul.trim().length < 3) e.judul = 'Judul minimal 3 karakter.';
      else if (f.judul.length > 100) e.judul = 'Judul maksimal 100 karakter.';

      if (!f.kategori) e.kategori = 'Pilih kategori mata kuliah.';
      if (!f.upbjj) e.upbjj = 'Pilih UT-Daerah.';

      if (!f.lokasiRak) e.lokasiRak = 'Lokasi rak wajib diisi.';
      else if (!/^R\d{1,2}-[A-Z]\d{1,2}$/.test(f.lokasiRak)) e.lokasiRak = 'Format: R<no>-<huruf><no>, mis. R1-A3.';

      if (!isInt(f.harga)) e.harga = 'Harga wajib diisi (bilangan bulat).';
      else if (f.harga < 1000) e.harga = 'Harga minimal Rp 1.000.';
      else if (f.harga > 10000000) e.harga = 'Harga maksimal Rp 10.000.000.';

      if (!isInt(f.qty)) e.qty = 'Jumlah stok wajib diisi (bilangan bulat).';
      else if (f.qty < 0) e.qty = 'Jumlah stok tidak boleh negatif.';

      if (!isInt(f.safety)) e.safety = 'Safety stock wajib diisi (bilangan bulat).';
      else if (f.safety < 1) e.safety = 'Safety stock minimal 1.';

      if (f.catatanHTML.length > 300) e.catatanHTML = 'Catatan maksimal 300 karakter.';
      return e;
    },

    isValid() { return Object.keys(this.errors).length === 0; },

    errorCount() { return Object.keys(this.errors).length; },

    /** Pratinjau catatan yang sudah disanitasi (aman untuk v-html) */
    catatanPreview() { return Api.sanitizeHtml(this.form.catatanHTML); },

    /** Pratinjau status hanya bila qty & safety valid */
    canPreviewStatus() { return !this.errors.qty && !this.errors.safety; },

    selisih() { return Number(this.form.qty) - Number(this.form.safety); }
  },

  watch: {
    /* Watcher: normalisasi input secara langsung (huruf besar, tanpa spasi) */
    'form.kode'(val) {
      const clean = String(val || '').toUpperCase().replace(/\s+/g, '');
      if (clean !== val) this.form.kode = clean;
    },
    'form.lokasiRak'(val) {
      const clean = String(val || '').toUpperCase().replace(/\s+/g, '');
      if (clean !== val) this.form.lokasiRak = clean;
    }
  },

  methods: {
    /**
     * Field ditandai "disentuh" saat blur HANYA bila sudah diisi.
     * Field wajib yang masih kosong baru diberi pesan error setelah tombol Simpan ditekan,
     * sehingga tata letak tidak bergeser ketika pengguna mengklik tombol Batal/Simpan.
     */
    touch(field) {
      if (String(this.form[field] ?? '') !== '') this.$set(this.touched, field, true);
    },

    /** Error hanya tampil bila field sudah disentuh atau form pernah disubmit */
    errorOf(field) {
      return (this.touched[field] || this.submitted) ? this.errors[field] : '';
    },

    onEnter(e) {
      if (e.target.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      this.submit();
    },

    submit() {
      this.submitted = true;
      if (!this.isValid) {
        this.$nextTick(() => {
          const el = this.$el.querySelector('.is-invalid');
          if (el) el.focus();
        });
        return;
      }
      const f = this.form;
      this.$emit('submit', {
        mode: this.mode,
        item: {
          id: f.id || Api.uid('ba'),
          kode: f.kode,
          judul: f.judul.trim(),
          kategori: f.kategori,
          upbjj: f.upbjj,
          lokasiRak: f.lokasiRak,
          harga: Number(f.harga),
          qty: Number(f.qty),
          safety: Number(f.safety),
          catatanHTML: Api.sanitizeHtml(f.catatanHTML)
        }
      });
    }
  }
});
