/* Panel Admin Pemantau Pesanan — proyek XII-E */
(function (root) {
  'use strict';

  var TOKO = root.TOKO || { nama: 'D SECO', mataUang: 'Rp', admin: { username: 'admin', pin: '362008' } };
  var StrukKit = root.StrukKit;
  var KUNCI_SESI = 'katalog-admin-sesi';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rp(n) { return (TOKO.mataUang || 'Rp') + Math.round(n || 0).toLocaleString('id-ID'); }

  var tt;
  function toast(m) {
    var t = $('#toast'); if (!t) return;
    t.textContent = m; t.classList.add('tampil');
    clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('tampil'); }, 2400);
  }

  function pasangLogo() {
    var el = document.querySelector('.merek-ikon'); if (!el) return;
    var inisial = function () { el.classList.remove('ada-logo'); el.textContent = (TOKO.nama || 'D').trim().charAt(0).toUpperCase(); };
    if (!TOKO.logo) return inisial();
    var img = new Image(); img.alt = ''; img.onerror = inisial; img.src = TOKO.logo;
    el.textContent = ''; el.appendChild(img); el.classList.add('ada-logo');
  }

  var semuaPesanan = [];

  function sudahMasuk() {
    try { return sessionStorage.getItem(KUNCI_SESI) === '1'; } catch (e) { return false; }
  }
  function setMasuk(v) {
    try { if (v) sessionStorage.setItem(KUNCI_SESI, '1'); else sessionStorage.removeItem(KUNCI_SESI); } catch (e) {}
  }

  function tampilkanTampilan() {
    var masuk = sudahMasuk();
    $('#adminLogin').hidden = masuk;
    $('#adminPanel').hidden = !masuk;
    $('#btnKeluar').hidden = !masuk;
    if (masuk) muatPesanan();
  }

  function muatPesanan() {
    var badge = $('#statusKoneksi');
    var wadah = $('#daftarPesanan');
    wadah.innerHTML = '<div class="kosong"><b>Memuat data pesanan…</b></div>';
    StrukKit.ambilSemuaPesanan(TOKO).then(function (res) {
      semuaPesanan = (res && res.data) || [];
      if (res.mode === 'supabase' && res.ok) {
        badge.className = 'admin-koneksi';
        badge.innerHTML = '<i></i>Terhubung ke Supabase (Real-time)';
      } else if (res.error) {
        badge.className = 'admin-koneksi lokal';
        badge.innerHTML = '<i></i>Gagal terhubung Supabase — menampilkan data lokal (' + esc(res.error) + ')';
      } else {
        badge.className = 'admin-koneksi lokal';
        badge.innerHTML = '<i></i>Mode Lokal — isi URL &amp; Anon Key Supabase di produk.js agar sinkron antar perangkat';
      }
      renderStatistik();
      renderDaftar();
    });
  }

  function renderStatistik() {
    var aktif = semuaPesanan.filter(function (p) { return p.status !== 'Dibatalkan'; });
    var omzet = aktif.reduce(function (s, p) { return s + (Number(p.total) || 0); }, 0);
    var baru = semuaPesanan.filter(function (p) { return (p.status || 'Baru') === 'Baru'; }).length;
    var selesai = semuaPesanan.filter(function (p) { return p.status === 'Selesai'; }).length;
    $('#statTotal').textContent = semuaPesanan.length;
    $('#statOmzet').textContent = rp(omzet);
    $('#statBaru').textContent = baru;
    $('#statSelesai').textContent = selesai;
  }

  function renderDaftar() {
    var q = ($('#cariPesanan').value || '').trim().toLowerCase();
    var st = $('#filterStatus').value || 'Semua';
    var list = semuaPesanan.filter(function (p) {
      var cocokStatus = st === 'Semua' || (p.status || 'Baru') === st;
      if (!cocokStatus) return false;
      if (!q) return true;
      var teksItem = (p.items || []).map(function (i) { return i.nama + ' ' + (i.label || ''); }).join(' ');
      return (p.kode + ' ' + p.nama + ' ' + (p.catatan || '') + ' ' + teksItem).toLowerCase().indexOf(q) > -1;
    });

    var wadah = $('#daftarPesanan');
    if (!list.length) {
      wadah.innerHTML = '<div class="kosong"><b>Belum ada pesanan yang cocok</b><span>Pesanan yang masuk dari pembeli akan muncul otomatis di sini.</span></div>';
      return;
    }

    var opsiStatus = ['Baru', 'Diproses', 'Selesai', 'Dibatalkan'];
    wadah.innerHTML = list.map(function (p, idx) {
      var kunciId = p.id != null ? String(p.id) : p.kode;
      var statusSaatIni = p.status || 'Baru';
      var itemHtml = (p.items || []).map(function (it) {
        return '<div><span>' + esc(it.qty) + 'x ' + esc(it.nama) + (it.label ? ' <small class="redup">(' + esc(it.label) + ')</small>' : '') + '</span><b>' + esc(rp((it.harga || 0) * (it.qty || 1))) + '</b></div>';
      }).join('');

      return '<article class="pesanan-kartu" data-kode="' + esc(p.kode) + '" data-id="' + esc(kunciId) + '">' +
        '<div class="pesanan-kepala">' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<span class="pesanan-kode">' + esc(p.kode) + '</span>' +
            '<span class="pesanan-waktu">' + esc(StrukKit.formatWaktu(p.created_at)) + '</span>' +
          '</div>' +
          '<span class="admin-koneksi' + (statusSaatIni === 'Dibatalkan' ? ' lokal' : '') + '"><i></i>' + esc(statusSaatIni) + '</span>' +
        '</div>' +
        '<div class="pesanan-isi">' +
          '<div class="pesanan-form">' +
            '<small>Data Formulir Pemesan</small>' +
            '<b>' + esc(p.nama) + '</b>' +
            '<span>Pengambilan: Takeaway (Ambil di stan)</span>' +
            '<span>Catatan: ' + esc(p.catatan || '-') + '</span>' +
          '</div>' +
          '<div class="pesanan-items">' +
            '<small class="redup">Rincian Produk</small>' +
            itemHtml +
          '</div>' +
        '</div>' +
        '<div class="pesanan-kaki">' +
          '<span class="pesanan-total">' + esc(rp(p.total)) + '</span>' +
          '<div class="pesanan-aksi">' +
            '<select class="ubah-status" data-id="' + esc(kunciId) + '" aria-label="Ubah status pesanan ' + esc(p.kode) + '">' +
              opsiStatus.map(function (o) { return '<option value="' + o + '"' + (o === statusSaatIni ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
            '</select>' +
            '<button type="button" class="tombol-sekunder" data-struk="' + idx + '">Lihat Struk / PDF</button>' +
            '<button type="button" class="tombol-sekunder tombol-bahaya" data-hapus="' + esc(kunciId) + '">Hapus</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    wadah._tampil = list;
  }

  function bukaStrukAdmin(pesanan) {
    var modal = $('#strukModal'), isi = $('#strukModalIsi');
    isi.innerHTML =
      '<div class="struk-modal-bungkus">' +
        '<header class="struk-modal-kepala">' +
          '<div><h2>Struk ' + esc(pesanan.kode) + '</h2><span class="struk-status">Pemesan: ' + esc(pesanan.nama) + '</span></div>' +
          '<button class="ikon-btn" id="tutupStruk" aria-label="Tutup struk"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</header>' +
        '<div class="struk-modal-badan">' + StrukKit.renderStrukHTML(pesanan, TOKO) + '</div>' +
        '<div class="struk-aksi">' +
          '<div class="struk-aksi-baris" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
            '<button type="button" class="tombol-sekunder" id="aksiCetakPDF">Cetak / Download PDF</button>' +
            '<button type="button" class="tombol-sekunder" id="aksiUnduhPNG">Download Gambar (PNG)</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (!modal.open) modal.showModal();
    isi.onclick = function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      if (btn.id === 'tutupStruk') return modal.close();
      if (btn.id === 'aksiCetakPDF') StrukKit.cetakStrukPDF(pesanan, TOKO);
      else if (btn.id === 'aksiUnduhPNG') {
        StrukKit.unduhStrukPNG(pesanan, TOKO)
          .then(function () { toast('Gambar struk tersimpan'); })
          .catch(function () { toast('Gagal mengunduh gambar'); });
      }
    };
  }

  // Event listeners
  $('#namaToko').textContent = TOKO.nama || 'D SECO';
  document.title = 'Admin — ' + (TOKO.nama || 'D SECO');
  pasangLogo();

  $('#btnTema').onclick = function () {
    var gelap = document.documentElement.getAttribute('data-mode') !== 'gelap';
    document.documentElement.setAttribute('data-mode', gelap ? 'gelap' : 'terang');
    try { localStorage.setItem('katalog-tema', gelap ? 'gelap' : 'terang'); } catch (e) {}
  };

  $('#formLogin').onsubmit = function (e) {
    e.preventDefault();
    var u = e.target.elements.username.value.trim();
    var p = e.target.elements.pin.value.trim();
    var kred = TOKO.admin || { username: 'admin', pin: '362008' };
    var galat = $('#loginGalat');
    if (u === String(kred.username) && p === String(kred.pin)) {
      galat.hidden = true;
      e.target.reset();
      setMasuk(true);
      tampilkanTampilan();
    } else {
      galat.textContent = 'Username atau PIN salah. Silakan coba lagi.';
      galat.hidden = false;
    }
  };

  $('#btnKeluar').onclick = function () {
    setMasuk(false);
    tampilkanTampilan();
  };

  $('#btnSegarkan').onclick = muatPesanan;
  $('#cariPesanan').oninput = renderDaftar;
  $('#filterStatus').onchange = renderDaftar;

  $('#daftarPesanan').addEventListener('change', function (e) {
    var sel = e.target.closest('.ubah-status');
    if (!sel) return;
    var id = sel.dataset.id, statusBaru = sel.value;
    StrukKit.ubahStatusPesanan(id, statusBaru, TOKO).then(function (res) {
      semuaPesanan.forEach(function (x) {
        if (String(x.id) === id || x.kode === id) x.status = statusBaru;
      });
      renderStatistik();
      renderDaftar();
      toast(res.ok ? 'Status diperbarui menjadi ' + statusBaru : 'Status diperbarui lokal (cek Supabase)');
    });
  });

  $('#daftarPesanan').addEventListener('click', function (e) {
    var btn = e.target.closest('button'); if (!btn) return;
    if (btn.dataset.struk != null) {
      var list = $('#daftarPesanan')._tampil || [];
      var item = list[+btn.dataset.struk];
      if (item) bukaStrukAdmin(item);
    } else if (btn.dataset.hapus) {
      var id = btn.dataset.hapus;
      if (!confirm('Hapus pesanan ini secara permanen?')) return;
      StrukKit.hapusPesanan(id, TOKO).then(function (res) {
        semuaPesanan = semuaPesanan.filter(function (x) { return String(x.id) !== id && x.kode !== id; });
        renderStatistik();
        renderDaftar();
        toast(res.ok ? 'Pesanan dihapus' : 'Pesanan dihapus lokal (cek Supabase)');
      });
    }
  });

  $('#strukModal').addEventListener('click', function (e) { if (e.target === this) this.close(); });

  tampilkanTampilan();
})(typeof window !== 'undefined' ? window : this);
