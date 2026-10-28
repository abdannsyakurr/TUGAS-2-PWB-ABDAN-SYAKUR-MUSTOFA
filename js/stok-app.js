/* Logika Vue untuk stok.html (Vue 2) */
function salin(obj) { return JSON.parse(JSON.stringify(obj)); }
function jamSekarang() { return new Date().toLocaleTimeString('id-ID'); }
function formKosong() {
  return { kode: '', judul: '', kategori: '', upbjj: '', lokasiRak: '', harga: null, qty: null, safety: null, catatan: '' };
}

var app = new Vue({
  el: '#app',
  data: {
    upbjjList: dataBahanAjar.upbjjList.slice(),
    kategoriList: dataBahanAjar.kategoriList.slice(),
    stok: salin(dataBahanAjar.stok),

    // filter dan sort
    filterUpbjj: '',
    filterKategori: '',
    hanyaReorder: false,
    sortBy: '',
    sortDir: 'asc',
    infoFilter: '',

    // formulir tambah
    tampilTambah: false,
    formTambah: formKosong(),
    errTambah: {},

    // modal edit
    editItem: null,
    errEdit: {},

    toast: { tampil: false, pesan: '', tipe: 'ok' },
    terakhirUpdate: jamSekarang()
  },

  computed: {
    // Opsi kategori bergantung pada UT-Daerah yang dipilih (dependent options)
    kategoriOptions: function () {
      if (!this.filterUpbjj) return [];
      var hitung = {};
      this.stok.forEach(function (s) {
        if (s.upbjj === this.filterUpbjj) hitung[s.kategori] = (hitung[s.kategori] || 0) + 1;
      }, this);
      return this.kategoriList
        .filter(function (k) { return hitung[k]; })
        .map(function (k) { return { nama: k, jumlah: hitung[k] }; });
    },

    // Satu computed untuk semua filter dan sort. Hasilnya di-cache Vue,
    // jadi hanya dihitung ulang kalau salah satu data yang dipakai berubah.
    filteredStok: function () {
      var self = this;
      var hasil = this.stok.filter(function (s) {
        if (self.filterUpbjj && s.upbjj !== self.filterUpbjj) return false;
        if (self.filterKategori && s.kategori !== self.filterKategori) return false;
        if (self.hanyaReorder && !(s.qty < s.safety || s.qty === 0)) return false;
        return true;
      });
      if (this.sortBy) {
        var arah = this.sortDir === 'desc' ? -1 : 1;
        var kunci = this.sortBy;
        hasil.sort(function (a, b) {
          var x = a[kunci], y = b[kunci];
          if (typeof x === 'string') return x.localeCompare(y) * arah;
          return (x - y) * arah;
        });
      }
      return hasil;
    },

    jumlahMenipis: function () {
      return this.stok.filter(function (s) { return s.qty > 0 && s.qty < s.safety; }).length;
    },
    jumlahKosong: function () {
      return this.stok.filter(function (s) { return s.qty === 0; }).length;
    }
  },

  watch: {
    // Watcher 1: ganti UT-Daerah -> kategori direset karena opsinya ikut berubah
    filterUpbjj: function (baru) {
      this.filterKategori = '';
      this.infoFilter = baru ? 'UT-Daerah: ' + baru : '';
    },
    // Watcher 2: aktifkan filter re-order -> otomatis urutkan dari stok paling sedikit
    hanyaReorder: function (aktif) {
      if (aktif && !this.sortBy) {
        this.sortBy = 'qty';
        this.sortDir = 'asc';
      }
    },
    // Watcher 3: data stok berubah (tambah atau edit) -> perbarui waktu terakhir
    stok: {
      deep: true,
      handler: function () { this.terakhirUpdate = jamSekarang(); }
    }
  },

  methods: {
    formatRupiah: function (n) {
      return 'Rp ' + Number(n).toLocaleString('id-ID');
    },

    resetFilter: function () {
      this.filterUpbjj = '';
      this.filterKategori = '';
      this.hanyaReorder = false;
      this.sortBy = '';
      this.sortDir = 'asc';
      this.infoFilter = '';
    },

    tampilToast: function (pesan, tipe) {
      var self = this;
      this.toast = { tampil: true, pesan: pesan, tipe: tipe || 'ok' };
      clearTimeout(this._timerToast);
      this._timerToast = setTimeout(function () { self.toast.tampil = false; }, 2600);
    },

    // Catatan boleh berisi tag format sederhana. Selain itu diubah jadi teks biasa.
    bersihkanCatatan: function (teks) {
      var aman = String(teks || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return aman.replace(/&lt;(\/?)(b|strong|i|em|u)&gt;/gi, '<$1$2>');
    },

    // Validasi sederhana, dipakai oleh formulir tambah dan formulir edit
    validasi: function (f, cekKodeBaru) {
      var e = {};
      var kode = String(f.kode || '').trim().toUpperCase();
      if (!kode) e.kode = 'Kode wajib diisi.';
      else if (!/^[A-Z]{3,6}\d{4}$/.test(kode)) e.kode = 'Format kode: 3-6 huruf diikuti 4 angka, contoh EKMA4116.';
      else if (cekKodeBaru && this.stok.some(function (s) { return s.kode === kode; })) e.kode = 'Kode ini sudah ada.';

      if (!f.judul || String(f.judul).trim().length < 3) e.judul = 'Judul minimal 3 karakter.';
      if (!f.kategori) e.kategori = 'Pilih kategori.';
      if (!f.upbjj) e.upbjj = 'Pilih UT-Daerah.';
      if (!/^R\d{1,2}-[A-Z]\d{1,2}$/.test(String(f.lokasiRak || '').trim().toUpperCase())) e.lokasiRak = 'Format lokasi rak: R1-A3.';
      if (!(Number.isInteger(f.harga) && f.harga > 0)) e.harga = 'Harga harus bilangan bulat lebih dari 0.';
      if (!(Number.isInteger(f.qty) && f.qty >= 0)) e.qty = 'Jumlah stok harus bilangan bulat, minimal 0.';
      if (!(Number.isInteger(f.safety) && f.safety >= 0)) e.safety = 'Safety stock harus bilangan bulat, minimal 0.';
      return e;
    },

    // ----- Tambah stok -----
    tambahStok: function () {
      this.errTambah = this.validasi(this.formTambah, true);
      if (Object.keys(this.errTambah).length > 0) {
        this.tampilToast('Periksa lagi isian yang berwarna merah.', 'bad');
        return;
      }
      var f = this.formTambah;
      this.stok.push({
        kode: f.kode.trim().toUpperCase(),
        judul: f.judul.trim(),
        kategori: f.kategori,
        upbjj: f.upbjj,
        lokasiRak: f.lokasiRak.trim().toUpperCase(),
        harga: f.harga,
        qty: f.qty,
        safety: f.safety,
        catatanHTML: this.bersihkanCatatan(f.catatan)
      });
      this.tampilToast('Stok ' + f.kode.trim().toUpperCase() + ' berhasil ditambahkan.');
      this.resetFormTambah();
    },
    resetFormTambah: function () {
      this.formTambah = formKosong();
      this.errTambah = {};
    },

    // ----- Edit stok -----
    mulaiEdit: function (item) {
      this.editItem = salin(item);
      this.errEdit = {};
    },
    batalEdit: function () {
      this.editItem = null;
      this.errEdit = {};
    },
    simpanEdit: function () {
      this.errEdit = this.validasi(this.editItem, false);
      if (Object.keys(this.errEdit).length > 0) return;
      var e = this.editItem;
      var asli = this.stok.find(function (s) { return s.kode === e.kode; });
      Object.assign(asli, {
        judul: e.judul.trim(),
        kategori: e.kategori,
        upbjj: e.upbjj,
        lokasiRak: e.lokasiRak.trim().toUpperCase(),
        harga: e.harga,
        qty: e.qty,
        safety: e.safety,
        catatanHTML: this.bersihkanCatatan(e.catatanHTML)
      });
      this.tampilToast('Stok ' + e.kode + ' berhasil diperbarui.');
      this.batalEdit();
    }
  }
});
