/*
 * <status-badge> — badge status stok bahan ajar ATAU status Delivery Order.
 *
 * Pemakaian:
 *   <status-badge :qty="item.qty" :safety="item.safety"></status-badge>   -> Aman / Menipis / Kosong
 *   <status-badge :status="rec.status"></status-badge>                    -> status DO
 *
 * Aturan status stok (diimplementasikan dengan v-if / v-else-if / v-else di template):
 *   qty === 0          -> Kosong  (merah,  ikon bahaya)
 *   qty <  safety      -> Menipis (oranye, ikon peringatan)
 *   qty >= safety      -> Aman    (hijau,  ikon centang)
 */
Vue.component('status-badge', {
  template: '#tpl-badge',

  props: {
    qty: { type: Number, default: 0 },
    safety: { type: Number, default: 0 },
    status: { type: String, default: '' },  // diisi -> mode status DO
    compact: { type: Boolean, default: false }
  },

  computed: {
    /* Warna & ikon untuk status DO */
    doTone() {
      const s = this.status.toLowerCase();
      if (s.includes('terkirim') || s.includes('selesai') || s.includes('diterima')) return 'success';
      if (s.includes('batal')) return 'danger';
      if (s.includes('perjalanan') || s.includes('dikirim')) return 'info';
      return 'neutral';
    },
    doIcon() {
      return {
        success: 'bi-patch-check-fill',
        danger: 'bi-x-circle-fill',
        info: 'bi-truck',
        neutral: 'bi-hourglass-split'
      }[this.doTone];
    }
  }
});
