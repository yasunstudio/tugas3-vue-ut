/*
 * <app-modal> — dialog/modal serbaguna.
 *
 * Dua mode pemakaian:
 *   1. Mode slot (deklaratif) — untuk formulir:
 *        <app-modal :show="form.open" title="Tambah Bahan Ajar" @close="form.open = false">
 *          <ba-stock-form ...></ba-stock-form>
 *        </app-modal>
 *
 *   2. Mode konfirmasi (programatik) — untuk pop up konfirmasi hapus:
 *        const ok = await this.$refs.modal.confirm({ title, message, variant: 'danger' });
 *
 * Interaksi keyboard & mouse:
 *   Esc            -> menutup modal / membatalkan konfirmasi
 *   Enter          -> menyetujui konfirmasi
 *   klik backdrop  -> menutup modal
 */
const MODAL_DEFAULTS = {
  title: 'Konfirmasi',
  message: '',
  detail: '',
  confirmText: 'Ya, lanjutkan',
  cancelText: 'Batal',
  variant: 'primary',          // primary | danger
  icon: 'bi-question-circle'
};

Vue.component('app-modal', {
  template: '#tpl-modal',

  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    icon: { type: String, default: '' },
    size: { type: String, default: 'md' }  // sm | md | lg
  },

  data() {
    return {
      dialog: Object.assign({ open: false }, MODAL_DEFAULTS),
      resolver: null
    };
  },

  computed: {
    isOpen() { return this.show || this.dialog.open; },
    currentTitle() { return this.dialog.open ? this.dialog.title : this.title; },
    currentIcon() { return this.dialog.open ? this.dialog.icon : this.icon; },
    currentSize() { return this.dialog.open ? 'sm' : this.size; }
  },

  watch: {
    /* Watcher: saat modal terbuka/tertutup -> kunci scroll body, pasang listener keyboard, atur fokus */
    isOpen(open) {
      document.body.classList.toggle('no-scroll', open);
      if (open) {
        document.addEventListener('keydown', this.onKeydown);
        this.$nextTick(() => {
          const target = this.dialog.open
            ? this.$refs.confirmBtn
            : this.$el.querySelector('input:not([readonly]), select, textarea');
          (target || this.$refs.panel)?.focus();
        });
      } else {
        document.removeEventListener('keydown', this.onKeydown);
      }
    }
  },

  methods: {
    /** Membuka pop up konfirmasi; resolve(true) bila disetujui, resolve(false) bila batal. */
    confirm(options = {}) {
      if (this.resolver) this.resolver(false);
      Object.assign(this.dialog, MODAL_DEFAULTS, options, { open: true });
      return new Promise((resolve) => { this.resolver = resolve; });
    },

    answer(value) {
      this.dialog.open = false;
      const resolve = this.resolver;
      this.resolver = null;
      if (resolve) resolve(value);
    },

    close() {
      if (this.dialog.open) this.answer(false);
      else this.$emit('close');
    },

    onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'Enter' && this.dialog.open && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        this.answer(true);
      }
    }
  },

  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeydown);
    document.body.classList.remove('no-scroll');
  }
});
