/* Panel Admin Pemantau Pesanan — proyek XII-E */
(function (root) {
  'use strict';

  var TOKO = root.TOKO || { nama: 'D SECO', mataUang: 'Rp', admin: { username: 'admin', pin: '362008' } };
  var PRODUK = root.PRODUK || [];
  var StrukKit = root.StrukKit;
  var KUNCI_SESI = 'katalog-admin-sesi';
  var INTERVAL_SYNC_MS = 15000;
  var timerSinkron = null;
  var sedangMuat = false;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rp(n) { return (TOKO.mataUang || 'Rp') + Math.round(n || 0).toLocaleString('id-ID'); }

  // Simpan stok awal dari produk.js agar sinkronisasi selalu akurat
  PRODUK.forEach(function (p) {
    if (p.stokAwal == null) p.stokAwal = Number(p.stok) || 0;
  });

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

  function aturPolling(aktif) {
    if (timerSinkron) {
      clearInterval(timerSinkron);
      timerSinkron = null;
    }
    if (aktif) {
      timerSinkron = setInterval(function () {
        if (!document.hidden && sudahMasuk()) muatPesanan(true);
      }, INTERVAL_SYNC_MS);
    }
  }

  function tampilkanTampilan() {
    var masuk = sudahMasuk();
    $('#adminLogin').hidden = masuk;
    $('#adminPanel').hidden = !masuk;
    $('#btnKeluar').hidden = !masuk;
    aturPolling(masuk);
    if (masuk) muatPesanan(false);
  }

  function muatPesanan(diam) {
    if (sedangMuat) return;
    sedangMuat = true;
    var badge = $('#statusKoneksi');
    var wadah = $('#daftarPesanan');
    if (!diam) {
      wadah.innerHTML = '<div class="kosong"><b>Memuat data pesanan…</b></div>';
    }
    StrukKit.ambilSemuaPesanan(TOKO).then(function (res) {
      sedangMuat = false;
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
      renderStok();
      renderDaftar();
    }).catch(function () {
      sedangMuat = false;
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

  function renderStok() {
    var wadah = $('#daftarStok');
    if (!wadah || !StrukKit || !StrukKit.terapkanStokRealTime) return;
    var ringkasan = StrukKit.terapkanStokRealTime(PRODUK, semuaPesanan);
    var info = $('#infoSinkronStok');
    if (info) {
      info.textContent = 'Diperbarui ' + StrukKit.formatWaktu(new Date().toISOString());
    }
    if (!ringkasan.length) {
      wadah.innerHTML = '<div class="kosong"><b>Belum ada produk terdaftar</b></div>';
      return;
    }
    wadah.innerHTML = ringkasan.map(function (r) {
      var cls = r.sisa === 0 ? 'habis' : (r.sisa <= 10 ? 'menipis' : 'tersedia');
      var persen = r.stokAwal > 0 ? Math.min(100, Math.round((r.sisa / r.stokAwal) * 100)) : 0;
      return '<div class="stok-kartu-admin">' +
        '<div class="stok-kartu-atas">' +
          '<div><b>' + esc(r.nama) + '</b><small class="redup">' + esc(r.kategori) + ' · ' + esc(rp(r.harga)) + '</small></div>' +
          '<span class="stok-lencana ' + cls + '">' + esc(r.status) + '</span>' +
        '</div>' +
        '<div class="stok-bar"><span class="stok-bar-isi ' + cls + '" style="width:' + persen + '%"></span></div>' +
        '<div class="stok-angka">' +
          '<span>Awal: <b>' + r.stokAwal + '</b></span>' +
          '<span>Terjual: <b>' + r.terjual + '</b></span>' +
          '<span>Sisa: <b>' + r.sisa + '</b></span>' +
        '</div>' +
        '<div class="stok-omzet redup">Omzet produk: <b>' + esc(rp(r.pendapatan)) + '</b></div>' +
      '</div>';
    }).join('');
  }

  function daftarTersaring() {
    var q = ($('#cariPesanan').value || '').trim().toLowerCase();
    var st = $('#filterStatus').value || 'Semua';
    return semuaPesanan.filter(function (p) {
      var cocokStatus = st === 'Semua' || (p.status || 'Baru') === st;
      if (!cocokStatus) return false;
      if (!q) return true;
      var teksItem = (p.items || []).map(function (i) { return i.nama + ' ' + (i.label || ''); }).join(' ');
      return (p.kode + ' ' + p.nama + ' ' + (p.catatan || '') + ' ' + (p.pengiriman || '') + ' ' + (p.alamat || '') + ' ' + (p.metode_bayar || '') + ' ' + teksItem).toLowerCase().indexOf(q) > -1;
    });
  }

  function renderDaftar() {
    var list = daftarTersaring();

    var wadah = $('#daftarPesanan');
    if (!list.length) {
      wadah.innerHTML = '<div class="kosong"><b>Belum ada pesanan yang cocok</b><span>Pesanan yang masuk dari pembeli akan muncul otomatis di sini.</span></div>';
      wadah._tampil = [];
      return;
    }

    var opsiStatus = ['Baru', 'Diproses', 'Selesai', 'Dibatalkan'];
    var opsiBayar = ['Belum Bayar', 'Menunggu Verifikasi', 'Lunas'];
    wadah.innerHTML = list.map(function (p, idx) {
      var kunciId = p.id != null ? String(p.id) : p.kode;
      var statusSaatIni = p.status || 'Baru';
      var statusBayar = p.status_bayar || 'Belum Bayar';
      var isDelivery = String(p.pengiriman || '').toLowerCase().indexOf('delivery') > -1 || p.metode_bayar === 'QRIS DANA';
      var itemHtml = (p.items || []).map(function (it) {
        return '<div><span>' + esc(it.qty) + 'x ' + esc(it.nama) + (it.label ? ' <small class="redup">(' + esc(it.label) + ')</small>' : '') + '</span><b>' + esc(rp((it.harga || 0) * (it.qty || 1))) + '</b></div>';
      }).join('');
      if (isDelivery) {
        itemHtml += '<div class="redup"><span>Ongkir</span><b>' + (p.ongkir > 0 ? esc(rp(p.ongkir)) : 'GRATIS') + '</b></div>';
      }

      return '<article class="pesanan-kartu" data-kode="' + esc(p.kode) + '" data-id="' + esc(kunciId) + '">' +
        '<div class="pesanan-kepala">' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<span class="pesanan-kode">' + esc(p.kode) + '</span>' +
            '<span class="pesanan-waktu">' + esc(StrukKit.formatWaktu(p.created_at)) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
            '<span class="admin-koneksi' + (statusBayar === 'Lunas' ? '' : ' lokal') + '"><i></i>' + esc(p.metode_bayar || 'Bayar di Stan') + ' · ' + esc(statusBayar) + '</span>' +
            '<span class="admin-koneksi' + (statusSaatIni === 'Dibatalkan' ? ' lokal' : '') + '"><i></i>' + esc(statusSaatIni) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pesanan-isi">' +
          '<div class="pesanan-form">' +
            '<small>Data Formulir Pemesan</small>' +
            '<b>' + esc(p.nama) + '</b>' +
            '<span>Pengiriman: ' + esc(p.pengiriman || 'Takeaway (Ambil di Stan)') + '</span>' +
            (isDelivery && p.alamat ? '<span>Alamat: ' + esc(p.alamat) + '</span>' : '') +
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
            '<select class="ubah-bayar" data-id="' + esc(kunciId) + '" aria-label="Ubah status bayar ' + esc(p.kode) + '">' +
              opsiBayar.map(function (o) { return '<option value="' + o + '"' + (o === statusBayar ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
            '</select>' +
            (p.bukti_bayar ? '<button type="button" class="tombol-sekunder" data-bukti="' + idx + '">Bukti Transfer</button>' : '') +
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

  function bukaBuktiAdmin(pesanan) {
    var modal = $('#strukModal'), isi = $('#strukModalIsi');
    isi.innerHTML =
      '<div class="struk-modal-bungkus">' +
        '<header class="struk-modal-kepala">' +
          '<div><h2>Bukti Transfer ' + esc(pesanan.kode) + '</h2><span class="struk-status">' + esc(pesanan.nama) + ' · ' + esc(rp(pesanan.total)) + '</span></div>' +
          '<button class="ikon-btn" id="tutupStruk" aria-label="Tutup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</header>' +
        '<div class="struk-modal-badan" style="text-align:center">' +
          '<img src="' + esc(pesanan.bukti_bayar) + '" alt="Bukti transfer" style="max-width:100%;max-height:60vh;border-radius:12px;border:1px solid var(--garis)">' +
        '</div>' +
        '<div class="struk-aksi">' +
          '<a class="tombol-sekunder" href="' + esc(pesanan.bukti_bayar) + '" download="bukti-' + esc(pesanan.kode.toLowerCase()) + '.jpg">Download Bukti Transfer</a>' +
        '</div>' +
      '</div>';

    if (!modal.open) modal.showModal();
    isi.onclick = function (e) {
      var btn = e.target.closest('button');
      if (btn && btn.id === 'tutupStruk') modal.close();
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

  $('#btnSegarkan').onclick = function () { muatPesanan(false); };
  $('#cariPesanan').oninput = renderDaftar;
  $('#filterStatus').onchange = renderDaftar;

  if ($('#btnCetakLaporan')) {
    $('#btnCetakLaporan').onclick = function () {
      var list = daftarTersaring();
      StrukKit.cetakLaporanOmsetPDF(list, PRODUK, TOKO, {
        status: $('#filterStatus').value || 'Semua',
        cari: ($('#cariPesanan').value || '').trim(),
        semuaPesanan: semuaPesanan
      });
    };
  }

  if ($('#btnUnduhCSV')) {
    $('#btnUnduhCSV').onclick = function () {
      var list = daftarTersaring();
      var namaFile = StrukKit.unduhLaporanCSV(list, PRODUK, TOKO, {
        status: $('#filterStatus').value || 'Semua',
        cari: ($('#cariPesanan').value || '').trim(),
        semuaPesanan: semuaPesanan
      });
      toast('Laporan diunduh: ' + namaFile);
    };
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && sudahMasuk()) muatPesanan(true);
  });
  window.addEventListener('focus', function () {
    if (sudahMasuk()) muatPesanan(true);
  });

  $('#daftarPesanan').addEventListener('change', function (e) {
    var selStatus = e.target.closest('.ubah-status');
    if (selStatus) {
      var id = selStatus.dataset.id, statusBaru = selStatus.value;
      StrukKit.ubahStatusPesanan(id, statusBaru, TOKO).then(function (res) {
        semuaPesanan.forEach(function (x) {
          if (String(x.id) === id || x.kode === id) x.status = statusBaru;
        });
        renderStatistik();
        renderStok();
        renderDaftar();
        toast(res.ok ? 'Status diperbarui menjadi ' + statusBaru : 'Status diperbarui lokal (cek Supabase)');
      });
      return;
    }
    var selBayar = e.target.closest('.ubah-bayar');
    if (selBayar) {
      var idB = selBayar.dataset.id, bayarBaru = selBayar.value;
      StrukKit.ubahStatusBayar(idB, bayarBaru, TOKO).then(function (res) {
        semuaPesanan.forEach(function (x) {
          if (String(x.id) === idB || x.kode === idB) x.status_bayar = bayarBaru;
        });
        renderDaftar();
        toast(res.ok ? 'Status pembayaran: ' + bayarBaru : 'Status bayar diperbarui lokal (cek Supabase)');
      });
    }
  });

  $('#daftarPesanan').addEventListener('click', function (e) {
    var btn = e.target.closest('button'); if (!btn) return;
    var list = $('#daftarPesanan')._tampil || [];
    if (btn.dataset.struk != null) {
      var item = list[+btn.dataset.struk];
      if (item) bukaStrukAdmin(item);
    } else if (btn.dataset.bukti != null) {
      var itemB = list[+btn.dataset.bukti];
      if (itemB && itemB.bukti_bayar) bukaBuktiAdmin(itemB);
    } else if (btn.dataset.hapus) {
      var id = btn.dataset.hapus;
      if (!confirm('Hapus pesanan ini secara permanen?')) return;
      StrukKit.hapusPesanan(id, TOKO).then(function (res) {
        semuaPesanan = semuaPesanan.filter(function (x) { return String(x.id) !== id && x.kode !== id; });
        renderStatistik();
        renderStok();
        renderDaftar();
        toast(res.ok ? 'Pesanan dihapus' : 'Pesanan dihapus lokal (cek Supabase)');
      });
    }
  });

  $('#strukModal').addEventListener('click', function (e) { if (e.target === this) this.close(); });

  tampilkanTampilan();
})(typeof window !== 'undefined' ? window : this);
