/*
 * <app-toast> — notifikasi singkat (toast) di pojok layar.
 *
 * Dipanggil dari root:  this.$refs.toast.push({ type: 'success', title, message })
 * type: success | warning | danger | info
 */
Vue.component('app-toast', {
  template: '#tpl-toast',

  data() {
    return { items: [] };
  },

  methods: {
    push({ type = 'success', title = '', message = '', timeout = 4000 } = {}) {
      const id = Api.uid('toast');
      this.items.push({ id, type, title, message });
      setTimeout(() => this.dismiss(id), timeout);
    },

    dismiss(id) {
      this.items = this.items.filter((t) => t.id !== id);
    },

    iconOf(type) {
      return {
        success: 'bi-check-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        danger: 'bi-x-octagon-fill',
        info: 'bi-info-circle-fill'
      }[type] || 'bi-info-circle-fill';
    }
  }
});
