/*
 * <order-form> — Formulir input Delivery Order (DO) baru.
 *
 * Props  : paket (state.paket), ekspedisi (state.pengirimanList), stok (untuk judul isi paket),
 *          next-number (Nomor DO otomatis yang dihitung root)
 * Events : created({ nomor, data })  -> root menyimpan DO baru ke state.tracking
 *
 * Field:
 *   Nomor DO       -> otomatis: DO + tahun berjalan + sequence (readonly)
 *   NIM, Nama      -> diisi manual (divalidasi)
 *   Ekspedisi      -> <select> dari pengirimanList (JNE Reguler / JNE Ekspres)
 *   Paket          -> <select> menampilkan kode + nama paket; detail isi paket muncul di bawahnya
 *   Tanggal Kirim  -> input date (manual) / tombol "Hari ini" (Date lokal); ditampilkan "25 Agustus 2025"
 *   Total Harga    -> diambil dari paket.harga lewat watcher; ditampilkan dengan format Rp
 */
const ORDER_FORM_EMPTY = () => ({
  nim: '',
  nama: '',
  ekspedisi: '',
  paket: '',
  tanggalKirim: Api.todayISO()
});

Vue.component('order-form', {
  template: '#tpl-order',

  props: {
    paket: { type: Array, required: true },
    ekspedisi: { type: Array, required: true },
    stok: { type: Array, default: () => [] },
    nextNumber: { type: String, required: true }
  },

  data() {
    return {
      form: ORDER_FORM_EMPTY(),
      total: 0,
      touched: {},
      submitted: false
    };
  },

  computed: {
    ekspedisiOptions() {
      return this.ekspedisi.map((e) => ({ kode: e.kode, label: `JNE ${e.nama}` }));
    },

    selectedEkspedisi() {
      return this.ekspedisiOptions.find((e) => e.kode === this.form.ekspedisi) || null;
    },

    selectedPaket() {
      return this.paket.find((p) => p.kode === this.form.paket) || null;
    },

    /* Detail isi paket: kode MK + judul + harga satuan dari data stok */
    paketItems() {
      if (!this.selectedPaket) return [];
      return this.selectedPaket.isi.map((kode) => {
        const found = this.stok.find((s) => s.kode === kode);
        return {
          kode,
          judul: found ? found.judul : '(tidak ada di data stok)',
          harga: found ? found.harga : 0,
          tersedia: found ? found.qty > 0 : false
        };
      });
    },

    hargaSatuan() {
      return this.paketItems.reduce((sum, it) => sum + it.harga, 0);
    },

    /* Teks untuk input readonly Total Harga (fungsi yang sama dengan filter `rupiah`) */
    totalText() {
      return this.total ? Format.rupiah(this.total) : 'Pilih paket terlebih dahulu';
    },

    hemat() {
      return Math.max(0, this.hargaSatuan - this.total);
    },

    isToday() {
      return this.form.tanggalKirim === Api.todayISO();
    },

    errors() {
      const f = this.form;
      const e = {};
      if (!f.nim) e.nim = 'NIM wajib diisi.';
      else if (!/^\d{9}$/.test(f.nim)) e.nim = `NIM harus 9 digit angka (saat ini ${f.nim.length} digit).`;

      const nama = f.nama.trim();
      if (!nama) e.nama = 'Nama wajib diisi.';
      else if (nama.length < 3) e.nama = 'Nama minimal 3 karakter.';
      else if (!/^[A-Za-zÀ-ÿ' .,-]+$/.test(nama)) e.nama = 'Nama hanya boleh berisi huruf, spasi, titik, atau tanda petik.';

      if (!f.ekspedisi) e.ekspedisi = 'Pilih jenis ekspedisi.';
      if (!f.paket) e.paket = 'Pilih paket bahan ajar.';

      if (!f.tanggalKirim) e.tanggalKirim = 'Tanggal kirim wajib diisi.';
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(f.tanggalKirim) || isNaN(new Date(f.tanggalKirim))) e.tanggalKirim = 'Format tanggal tidak valid.';
      return e;
    },

    isValid() { return Object.keys(this.errors).length === 0; },

    /* Kelengkapan form (untuk progress bar di ringkasan) */
    completion() {
      const fields = ['nim', 'nama', 'ekspedisi', 'paket', 'tanggalKirim'];
      const ok = fields.filter((f) => !this.errors[f]).length;
      return Math.round((ok / fields.length) * 100);
    }
  },

  watch: {
    /* Watcher: paket dipilih -> Total Harga otomatis diambil dari paket.harga */
    'form.paket'() {
      this.total = this.selectedPaket ? this.selectedPaket.harga : 0;
    },

    /* Watcher: NIM hanya menerima angka, maksimal 9 digit */
    'form.nim'(val) {
      const clean = String(val).replace(/\D/g, '').slice(0, 9);
      if (clean !== val) this.form.nim = clean;
    }
  },

  methods: {
    /** Lihat penjelasan di stock-form.js: field kosong baru divalidasi saat submit. */
    touch(field) {
      if (String(this.form[field] ?? '') !== '') this.$set(this.touched, field, true);
    },

    errorOf(field) {
      return (this.touched[field] || this.submitted) ? this.errors[field] : '';
    },

    /** Mengisi tanggal kirim dengan tanggal lokal hari ini (fungsi Date) */
    setToday() {
      this.form.tanggalKirim = Api.todayISO();
    },

    onEnter(e) {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      this.submit();
    },

    resetForm() {
      this.form = ORDER_FORM_EMPTY();
      this.touched = {};
      this.submitted = false;
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
      this.$emit('created', {
        nomor: this.nextNumber,
        data: {
          nim: f.nim,
          nama: f.nama.trim().replace(/\s+/g, ' '),
          status: 'Diproses',
          ekspedisi: this.selectedEkspedisi.label,
          tanggalKirim: f.tanggalKirim,
          paket: f.paket,
          total: this.total,
          perjalanan: [
            { waktu: Api.nowStamp(), keterangan: `DO dibuat · menunggu penjemputan ${this.selectedEkspedisi.label}` }
          ]
        }
      });
      this.resetForm();
    }
  }
});
