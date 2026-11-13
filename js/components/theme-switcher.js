/*
 * <theme-switcher> — pemilih tema: Sistem (default) / Terang / Gelap.
 *
 * Pemakaian (two-way binding dengan v-model):
 *   <theme-switcher v-model="themePref" :effective="theme"></theme-switcher>
 *
 * Props  : value     -> preferensi pengguna: 'system' | 'light' | 'dark'
 *          effective -> tema yang sedang tampil: 'light' | 'dark' (untuk keterangan "Sistem")
 * Events : input(pref)
 *
 * Interaksi: klik tombol membuka menu; klik opsi / Enter memilih; ↑ ↓ berpindah opsi;
 *            Esc atau klik di luar menutup menu.
 */
Vue.component('theme-switcher', {
  template: '#tpl-theme',

  props: {
    value: { type: String, default: 'system' },
    effective: { type: String, default: 'light' }
  },

  data() {
    return {
      open: false,
      options: [
        { value: 'system', label: 'Sistem', icon: 'bi-circle-half', hint: 'Ikuti perangkat' },
        { value: 'light', label: 'Terang', icon: 'bi-sun' },
        { value: 'dark', label: 'Gelap', icon: 'bi-moon-stars' }
      ]
    };
  },

  computed: {
    current() {
      return this.options.find((o) => o.value === this.value) || this.options[0];
    },
    buttonLabel() {
      const suffix = this.value === 'system' ? ` (saat ini ${this.effective === 'dark' ? 'gelap' : 'terang'})` : '';
      return `Tema: ${this.current.label}${suffix}`;
    }
  },

  watch: {
    /* Watcher: menu terbuka -> pasang listener klik-luar & fokus ke opsi terpilih */
    open(isOpen) {
      if (isOpen) {
        document.addEventListener('mousedown', this.onOutside);
        this.$nextTick(() => {
          const active = this.$el.querySelector('[aria-checked="true"]');
          if (active) active.focus();
        });
      } else {
        document.removeEventListener('mousedown', this.onOutside);
      }
    }
  },

  methods: {
    toggle() {
      this.open = !this.open;
    },
    close(returnFocus = true) {
      if (!this.open) return;
      this.open = false;
      if (returnFocus) this.$refs.button.focus();
    },
    choose(value) {
      this.$emit('input', value);
      this.close();
    },
    onOutside(e) {
      if (!this.$el.contains(e.target)) this.close(false);
    },
    /** Navigasi keyboard di dalam menu: panah atas/bawah, Home/End */
    moveFocus(step) {
      const items = Array.from(this.$el.querySelectorAll('.theme-menu__item'));
      const idx = items.indexOf(document.activeElement);
      const next = step === 'first' ? 0 : step === 'last' ? items.length - 1
        : (idx + step + items.length) % items.length;
      items[next].focus();
    }
  },

  beforeDestroy() {
    document.removeEventListener('mousedown', this.onOutside);
  }
});
