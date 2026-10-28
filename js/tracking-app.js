/* Logika Vue untuk tracking.html (Vue 2) */
function salin(obj) { return JSON.parse(JSON.stringify(obj)); }
function dua(n) { return String(n).padStart(2, '0'); }
function tanggalHariIni() {
  var d = new Date();
  return d.getFullYear() + '-' + dua(d.getMonth() + 1) + '-' + dua(d.getDate());
}
function waktuSekarang() {
  var d = new Date();
  return tanggalHariIni() + ' ' + dua(d.getHours()) + ':' + dua(d.getMinutes()) + ':' + dua(d.getSeconds());
}
function formKosong() {
  return { nim: '', nama: '', ekspedisiKode: '', paketKode: '', tanggalKirim: tanggalHariIni(), totalHarga: 0 };
}

var PROGRES_STATUS = { 'Dikemas': 15, 'Dikirim': 40, 'Dalam Perjalanan': 70, 'Selesai': 100 };

var app = new Vue({
  el: '#app',
  data: {
    pengirimanList: salin(dataBahanAjar.pengirimanList),
    paket: salin(dataBahanAjar.paket),
    stok: salin(dataBahanAjar.stok),
    tracking: salin(dataBahanAjar.tracking),

    keyword: '',
    nomorDipilih: '',
    pesanCari: '',

    form: formKosong(),
    errors: {},
    toast: { tampil: false, pesan: '', tipe: 'ok' }
  },

  computed: {
    // Nomor DO otomatis: DO + tahun berjalan + nomor urut 3 digit (DO2026-001, DO2026-002, ...)
    nomorBaru: function () {
      var tahun = new Date().getFullYear();
      var maks = 0;
      Object.keys(this.tracking).forEach(function (k) {
        var m = /^DO(\d{4})-(\d+)$/.exec(k);
        if (m && Number(m[1]) === tahun) maks = Math.max(maks, Number(m[2]));
      });
      return 'DO' + tahun + '-' + String(maks + 1).padStart(3, '0');
    },

    daftarDO: function () {
      var self = this;
      return Object.keys(this.tracking).sort().reverse().map(function (k) {
        return Object.assign({ nomor: k }, self.tracking[k]);
      });
    },

    hasil: function () {
      if (!this.nomorDipilih || !this.tracking[this.nomorDipilih]) return null;
      return Object.assign({ nomor: this.nomorDipilih }, this.tracking[this.nomorDipilih]);
    },
    persenProgress: function () {
      if (!this.hasil) return 0;
      var selesai = this.hasil.perjalanan.some(function (p) { return p.keterangan.indexOf('Selesai') === 0; });
      return selesai ? 100 : (PROGRES_STATUS[this.hasil.status] || 30);
    },
    perjalananUrut: function () {
      if (!this.hasil) return [];
      return this.hasil.perjalanan.slice().sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });
    },
    paketHasil: function () {
      if (!this.hasil) return null;
      return this.cariPaket(this.hasil.paket);
    },
    isiPaketHasil: function () {
      return this.detailIsi(this.paketHasil);
    },

    paketTerpilih: function () {
      return this.cariPaket(this.form.paketKode);
    },
    isiPaketTerpilih: function () {
      return this.detailIsi(this.paketTerpilih);
    }
  },

  watch: {
    // Watcher 1: nomor DO otomatis huruf besar, dan hasil lama dihapus kalau kolom dikosongkan
    keyword: function (baru) {
      var bersih = baru.toUpperCase().replace(/\s/g, '');
      if (bersih !== baru) this.keyword = bersih;
      this.pesanCari = '';
      if (bersih === '') this.nomorDipilih = '';
    },
    // Watcher 2: NIM hanya boleh angka, maksimal 9 digit
    'form.nim': function (baru) {
      var bersih = String(baru).replace(/\D/g, '').slice(0, 9);
      if (bersih !== baru) this.form.nim = bersih;
    },
    // Watcher 3: ganti paket -> total harga ikut berubah
    'form.paketKode': function (kode) {
      var p = this.cariPaket(kode);
      this.form.totalHarga = p ? p.harga : 0;
    }
  },

  methods: {
    formatRupiah: function (n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); },
    formatTanggal: function (teks) {
      var d = new Date(teks + 'T00:00:00');
      if (isNaN(d)) return teks;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    cariPaket: function (kode) {
      return this.paket.find(function (p) { return p.kode === kode; }) || null;
    },
    detailIsi: function (paket) {
      if (!paket) return [];
      var self = this;
      return paket.isi.map(function (kode) {
        var b = self.stok.find(function (s) { return s.kode === kode; });
        return { kode: kode, judul: b ? b.judul : '(judul belum tersedia)' };
      });
    },
    tampilToast: function (pesan, tipe) {
      var self = this;
      this.toast = { tampil: true, pesan: pesan, tipe: tipe || 'ok' };
      clearTimeout(this._timerToast);
      this._timerToast = setTimeout(function () { self.toast.tampil = false; }, 2600);
    },

    // ----- Cari DO -----
    cariDO: function () {
      if (!this.keyword) {
        this.pesanCari = 'Nomor DO wajib diisi.';
        this.nomorDipilih = '';
        return;
      }
      if (!this.tracking[this.keyword]) {
        this.pesanCari = 'Nomor DO "' + this.keyword + '" tidak ditemukan.';
        this.nomorDipilih = '';
        return;
      }
      this.pesanCari = '';
      this.nomorDipilih = this.keyword;
    },
    lihatDO: function (nomor) {
      this.keyword = nomor;
      this.cariDO();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ----- Buat DO baru -----
    isiHariIni: function () { this.form.tanggalKirim = tanggalHariIni(); },
    validasi: function () {
      var e = {};
      var f = this.form;
      if (!/^\d{9}$/.test(f.nim)) e.nim = 'NIM harus 9 digit angka.';
      if (String(f.nama).trim().length < 3) e.nama = 'Nama minimal 3 karakter.';
      else if (!/^[A-Za-z .,'-]+$/.test(String(f.nama).trim())) e.nama = 'Nama hanya boleh huruf dan spasi.';
      if (!f.ekspedisiKode) e.ekspedisi = 'Pilih ekspedisi.';
      if (!f.paketKode) e.paket = 'Pilih paket bahan ajar.';
      if (!f.tanggalKirim) e.tanggalKirim = 'Tanggal kirim wajib diisi.';
      return e;
    },
    simpanDO: function () {
      this.errors = this.validasi();
      if (Object.keys(this.errors).length > 0) {
        this.tampilToast('Periksa lagi isian yang berwarna merah.', 'bad');
        return;
      }
      var f = this.form;
      var nomor = this.nomorBaru;
      var eks = this.pengirimanList.find(function (e) { return e.kode === f.ekspedisiKode; });
      this.$set(this.tracking, nomor, {
        nim: f.nim,
        nama: String(f.nama).trim(),
        status: 'Dikemas',
        ekspedisi: 'JNE ' + eks.nama,
        tanggalKirim: f.tanggalKirim,
        paket: f.paketKode,
        total: f.totalHarga,
        perjalanan: [{ waktu: waktuSekarang(), keterangan: 'DO dibuat, paket sedang dikemas' }]
      });
      this.tampilToast('DO ' + nomor + ' berhasil dibuat.');
      this.keyword = nomor;
      this.nomorDipilih = nomor;
      this.resetForm();
    },
    resetForm: function () {
      this.form = formKosong();
      this.errors = {};
    }
  }
});
