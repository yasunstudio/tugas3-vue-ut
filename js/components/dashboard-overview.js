/*
 * <dashboard-overview> — Halaman Ringkasan (beranda dashboard).
 *
 * Props  : stok, tracking, upbjj-list
 * Events : navigate(tab), show-reorder, open-do(nomor)
 *
 * Semua angka KPI & grafik adalah computed property yang diturunkan dari state root,
 * sehingga otomatis ter-update setiap kali data stok / DO berubah di halaman lain.
 */
Vue.component('dashboard-overview', {
  template: '#tpl-dashboard',

  props: {
    stok: { type: Array, required: true },
    tracking: { type: Object, required: true },
    upbjjList: { type: Array, required: true }
  },

  data() {
    return { hoverBar: null };
  },

  computed: {
    greeting() {
      const h = new Date().getHours();
      if (h < 11) return 'Selamat pagi';
      if (h < 15) return 'Selamat siang';
      if (h < 18) return 'Selamat sore';
      return 'Selamat malam';
    },

    todayText() {
      return Format.tanggal(Api.todayISO());
    },

    doList() {
      return Object.keys(this.tracking)
        .map((nomor) => Object.assign({ nomor }, this.tracking[nomor]))
        .sort((a, b) => b.nomor.localeCompare(a.nomor));
    },

    kpi() {
      const s = this.stok;
      return {
        judul: s.length,
        eksemplar: s.reduce((t, i) => t + i.qty, 0),
        nilai: s.reduce((t, i) => t + i.qty * i.harga, 0),
        reorder: s.filter((i) => i.qty < i.safety || i.qty === 0).length,
        kosong: s.filter((i) => i.qty === 0).length,
        totalDO: this.doList.length,
        aktifDO: this.doList.filter((d) => d.status !== 'Terkirim' && d.status !== 'Dibatalkan').length
      };
    },

    /* Data grafik batang: total eksemplar per UT-Daerah */
    byUpbjj() {
      const rows = this.upbjjList.map((name) => {
        const items = this.stok.filter((i) => i.upbjj === name);
        return {
          name,
          judul: items.length,
          qty: items.reduce((t, i) => t + i.qty, 0),
          nilai: items.reduce((t, i) => t + i.qty * i.harga, 0),
          reorder: items.filter((i) => i.qty < i.safety).length
        };
      });
      const max = Math.max(1, ...rows.map((r) => r.qty));
      return rows.map((r) => Object.assign(r, { pct: Math.round((r.qty / max) * 100) }));
    },

    /* Komposisi status stok */
    statusDist() {
      const total = this.stok.length || 1;
      const kosong = this.stok.filter((i) => i.qty === 0).length;
      const menipis = this.stok.filter((i) => i.qty > 0 && i.qty < i.safety).length;
      const aman = this.stok.length - kosong - menipis;
      return [
        { key: 'success', label: 'Aman', icon: 'bi-check-circle-fill', count: aman, pct: (aman / total) * 100 },
        { key: 'warning', label: 'Menipis', icon: 'bi-exclamation-triangle-fill', count: menipis, pct: (menipis / total) * 100 },
        { key: 'danger', label: 'Kosong', icon: 'bi-x-octagon-fill', count: kosong, pct: (kosong / total) * 100 }
      ];
    },

    /* 5 bahan ajar dengan kekurangan stok terbesar */
    reorderList() {
      return this.stok
        .filter((i) => i.qty < i.safety || i.qty === 0)
        .map((i) => Object.assign({}, i, { kurang: Math.max(0, i.safety - i.qty) }))
        .sort((a, b) => b.kurang - a.kurang)
        .slice(0, 5);
    },

    recentDO() {
      return this.doList.slice(0, 5).map((d) => Object.assign({}, d, {
        last: d.perjalanan.length ? d.perjalanan[d.perjalanan.length - 1] : null
      }));
    }
  }
});
