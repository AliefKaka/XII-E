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
  var sedangEdit = false;
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

  function daftarOpsiPengiriman() {
    if (TOKO && TOKO.pengiriman && Array.isArray(TOKO.pengiriman.opsi) && TOKO.pengiriman.opsi.length) {
      return TOKO.pengiriman.opsi;
    }
    return [
      { id: 'takeaway', label: 'Takeaway (Ambil di Stan)', ongkir: 0, delivery: false },
      { id: 'lumajang-kota', label: 'Delivery — Lumajang Kota', ongkir: 0, delivery: true },
      { id: 'lain', label: 'Delivery — Lainnya', ongkir: 5000, delivery: true }
    ];
  }

  function cariOpsiPengirimanByLabel(label) {
    var list = daftarOpsiPengiriman();
    var target = String(label || '').trim().toLowerCase();
    return list.find(function (o) { return o.label.toLowerCase() === target; }) || null;
  }

  function adalahPengirimanDelivery(labelPengiriman) {
    var opsi = cariOpsiPengirimanByLabel(labelPengiriman);
    if (opsi) return !!opsi.delivery;
    return String(labelPengiriman || '').toLowerCase().indexOf('delivery') > -1;
  }

  function hitungOngkirOtomatis(labelPengiriman, totalQty) {
    var opsi = cariOpsiPengirimanByLabel(labelPengiriman);
    var isDelivery = opsi ? !!opsi.delivery : adalahPengirimanDelivery(labelPengiriman);
    if (!isDelivery) return { ongkir: 0, gratis: false, delivery: false, minGratis: 0 };
    var minGratis = (TOKO && TOKO.pengiriman && Number(TOKO.pengiriman.minGratisOngkir)) || 4;
    var tarif = opsi ? (Number(opsi.ongkir) || 0) : 0;
    var gratis = totalQty >= minGratis;
    return {
      ongkir: gratis ? 0 : tarif,
      gratis: gratis,
      delivery: true,
      minGratis: minGratis
    };
  }

  function buatPesanWaAdmin(p) {
    var isDelivery = adalahPengirimanDelivery(p.pengiriman);
    var isCod = String(p.metode_bayar || '').toLowerCase().indexOf('cod') > -1;
    var baris = ['Halo *' + (TOKO.nama || 'D SECO') + '*, saya mau pesan (' + (isDelivery ? 'Delivery' : 'Takeaway') + '):'];
    if (p.kode) baris.push('*Kode Pesanan: ' + p.kode + '*');
    baris.push('');
    (p.items || []).forEach(function (i, n) {
      baris.push((n + 1) + '. *' + i.nama + '*' + (i.label ? ' (' + i.label + ')' : ''));
      baris.push('   ' + i.qty + ' x ' + rp(i.harga) + ' = ' + rp((Number(i.qty) || 0) * (Number(i.harga) || 0)));
    });
    baris.push('');
    if (isDelivery) {
      baris.push('Subtotal: ' + rp(p.subtotal));
      baris.push('Ongkir (' + p.pengiriman + '): ' + (p.ongkir > 0 ? rp(p.ongkir) : 'GRATIS'));
      baris.push('*Total Bayar: ' + rp(p.total) + '*');
    } else {
      baris.push('*Total: ' + rp(p.total) + '*');
    }
    baris.push('');
    baris.push('Nama: ' + (p.nama || '-'));
    if (isDelivery) {
      baris.push('Pengiriman: ' + p.pengiriman);
      baris.push('Alamat Lengkap: ' + (p.alamat || '-'));
      baris.push('Pembayaran: ' + (p.metode_bayar || (isCod ? 'COD (Bayar di Tempat)' : 'QRIS DANA')));
    } else {
      baris.push('Pengambilan: Takeaway (Ambil di lokasi)');
    }
    if (p.catatan) baris.push('Catatan: ' + p.catatan);
    baris.push('');
    baris.push('Terima kasih!');
    return baris.join('\n');
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
        if (!document.hidden && sudahMasuk() && !sedangEdit) muatPesanan(true);
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
    var sb = ($('#filterBayar') && $('#filterBayar').value) || 'Semua';
    return semuaPesanan.filter(function (p) {
      var cocokStatus = st === 'Semua' || (p.status || 'Baru') === st;
      if (!cocokStatus) return false;
      var cocokBayar = sb === 'Semua' || (p.status_bayar || 'Belum Bayar') === sb;
      if (!cocokBayar) return false;
      if (!q) return true;
      var teksItem = (p.items || []).map(function (i) { return i.nama + ' ' + (i.label || ''); }).join(' ');
      return (p.kode + ' ' + p.nama + ' ' + (p.catatan || '') + ' ' + (p.pengiriman || '') + ' ' + (p.alamat || '') + ' ' + (p.metode_bayar || '') + ' ' + (p.status_bayar || '') + ' ' + teksItem).toLowerCase().indexOf(q) > -1;
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
            '<button type="button" class="tombol-sekunder" data-edit="' + idx + '">Edit Pesanan</button>' +
            (p.bukti_bayar ? '<button type="button" class="tombol-sekunder" data-bukti="' + idx + '">Bukti Transfer</button>' : '') +
            '<button type="button" class="tombol-sekunder" data-struk="' + idx + '">Lihat Struk / PDF</button>' +
            '<button type="button" class="tombol-sekunder tombol-bahaya" data-hapus="' + esc(kunciId) + '">Hapus</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    wadah._tampil = list;
  }

  function bukaEditPesanan(pesanan) {
    var modal = $('#editPesananModal'), isi = $('#editPesananIsi');
    if (!modal || !isi) return;

    var kunciId = pesanan.id != null ? String(pesanan.id) : pesanan.kode;
    var itemsEdit = (pesanan.items || []).map(function (it) {
      return {
        id: it.id || '',
        nama: it.nama || 'Produk',
        label: it.label || '',
        harga: Number(it.harga) || 0,
        qty: Math.max(1, Number(it.qty) || 1)
      };
    });

    var opsiPengiriman = daftarOpsiPengiriman();
    var pengirimanAwal = pesanan.pengiriman || opsiPengiriman[0].label;
    var adaDiDaftar = opsiPengiriman.some(function (o) { return o.label === pengirimanAwal; });
    var opsiPengirimanHtml = (adaDiDaftar ? '' : '<option value="' + esc(pengirimanAwal) + '">' + esc(pengirimanAwal) + '</option>') +
      opsiPengiriman.map(function (o) {
        return '<option value="' + esc(o.label) + '"' + (o.label === pengirimanAwal ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('');

    var metodeList = ['Bayar di Stan', 'QRIS DANA', 'COD (Bayar di Tempat)'];
    var metodeAwal = pesanan.metode_bayar || 'Bayar di Stan';
    if (metodeList.indexOf(metodeAwal) < 0) metodeList.unshift(metodeAwal);

    var statusBayarList = ['Belum Bayar', 'Menunggu Verifikasi', 'Lunas'];
    var statusBayarAwal = pesanan.status_bayar || 'Belum Bayar';

    var statusList = ['Baru', 'Diproses', 'Selesai', 'Dibatalkan'];
    var statusAwal = pesanan.status || 'Baru';

    var opsiProdukHtml = PRODUK.map(function (pr) {
      var sisa = Math.max(0, Number(pr.stok) || 0);
      return '<option value="' + esc(pr.id) + '">' + esc(pr.nama) + ' — ' + esc(rp(pr.harga)) + ' (Sisa ' + sisa + ')</option>';
    }).join('');

    var ongkirManual = false;
    var alamatStan = (TOKO.lokasi && TOKO.lokasi.alamat) || '';

    isi.innerHTML =
      '<div class="struk-modal-bungkus">' +
        '<header class="struk-modal-kepala">' +
          '<div><h2>Edit Pesanan ' + esc(pesanan.kode) + '</h2><span class="struk-status">Ubah data pemesan atau item tanpa membuat pesanan duplikat</span></div>' +
          '<button class="ikon-btn" id="tutupEditPesanan" type="button" aria-label="Tutup edit pesanan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</header>' +
        '<form id="formEditPesanan" class="struk-modal-badan edit-pesanan-form">' +
          '<div class="edit-grid-2">' +
            '<label>Nama Pemesan<input name="nama" required value="' + esc(pesanan.nama || '') + '" placeholder="Nama pemesan"></label>' +
            '<label>Pilihan Pengiriman<select name="pengiriman" id="editPengiriman">' + opsiPengirimanHtml + '</select></label>' +
          '</div>' +
          '<label id="editWrapAlamat"><span id="editLabelAlamat">Alamat Pengiriman</span><textarea name="alamat" id="editAlamat" rows="2" placeholder="Alamat lengkap pengiriman">' + esc(pesanan.alamat || '') + '</textarea></label>' +
          '<div class="edit-grid-2">' +
            '<label>Metode Pembayaran<select name="metode_bayar" id="editMetodeBayar">' +
              metodeList.map(function (m) { return '<option value="' + esc(m) + '"' + (m === metodeAwal ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') +
            '</select></label>' +
            '<label>Status Pembayaran<select name="status_bayar" id="editStatusBayar">' +
              statusBayarList.map(function (s) { return '<option value="' + esc(s) + '"' + (s === statusBayarAwal ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
            '</select></label>' +
          '</div>' +
          '<div class="edit-grid-2">' +
            '<label>Status Pesanan<select name="status" id="editStatus">' +
              statusList.map(function (s) { return '<option value="' + esc(s) + '"' + (s === statusAwal ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
            '</select></label>' +
            '<label>Ongkir (Rp)<input type="number" min="0" step="500" name="ongkir" id="editOngkir" value="' + Math.max(0, Math.round(Number(pesanan.ongkir) || 0)) + '"></label>' +
          '</div>' +
          '<label>Catatan<input name="catatan" value="' + esc(pesanan.catatan || '') + '" placeholder="Catatan tambahan (opsional)"></label>' +
          '<div class="edit-seksi">' +
            '<div class="edit-seksi-kepala"><b>Rincian Item Pesanan</b><small class="redup" id="editTotalQtyTeks"></small></div>' +
            '<div class="edit-item-daftar" id="editItemDaftar"></div>' +
            '<div class="edit-tambah-baris">' +
              '<select id="editPilihProduk" aria-label="Pilih produk untuk ditambahkan">' + opsiProdukHtml + '</select>' +
              '<input type="number" id="editQtyTambah" min="1" value="1" aria-label="Jumlah produk">' +
              '<button type="button" class="tombol-sekunder" id="btnTambahItemEdit">+ Tambah</button>' +
            '</div>' +
          '</div>' +
          '<div class="edit-ringkasan" id="editRingkasan"></div>' +
          '<p id="editGalat" class="admin-galat" hidden></p>' +
        '</form>' +
        '<div class="struk-aksi">' +
          '<div class="edit-aksi-kaki">' +
            '<button type="button" class="tombol-sekunder" id="btnBatalEdit">Batal</button>' +
            '<button type="submit" form="formEditPesanan" class="tombol" id="btnSimpanEdit">Simpan Perubahan</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var selPengiriman = $('#editPengiriman', isi);
    var inpAlamat = $('#editAlamat', isi);
    var lblAlamat = $('#editLabelAlamat', isi);
    var inpOngkir = $('#editOngkir', isi);
    var wadahItem = $('#editItemDaftar', isi);
    var ringkasanEl = $('#editRingkasan', isi);
    var qtyTeksEl = $('#editTotalQtyTeks', isi);
    var galatEl = $('#editGalat', isi);

    function hitungTotalItem() {
      var subtotal = itemsEdit.reduce(function (s, it) { return s + (Number(it.harga) || 0) * (Number(it.qty) || 0); }, 0);
      var totalQty = itemsEdit.reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0);
      return { subtotal: subtotal, totalQty: totalQty };
    }

    function sinkronPengirimanDanRingkasan(resetOngkirOtomatis) {
      var pg = selPengiriman.value;
      var isDelivery = adalahPengirimanDelivery(pg);
      if (isDelivery) {
        inpAlamat.readOnly = false;
        inpAlamat.classList.remove('alamat-terkunci');
        lblAlamat.textContent = 'Alamat Pengiriman (Wajib untuk Delivery)';
        if (inpAlamat.value.trim() === alamatStan && pesanan.alamat !== alamatStan) {
          inpAlamat.value = '';
        }
      } else {
        inpAlamat.readOnly = true;
        inpAlamat.classList.add('alamat-terkunci');
        lblAlamat.textContent = 'Alamat Stan (Takeaway)';
        inpAlamat.value = alamatStan || inpAlamat.value;
      }

      var h = hitungTotalItem();
      var auto = hitungOngkirOtomatis(pg, h.totalQty);
      if (!isDelivery) {
        inpOngkir.value = 0;
        inpOngkir.readOnly = true;
      } else {
        inpOngkir.readOnly = false;
        if (resetOngkirOtomatis && !ongkirManual) {
          inpOngkir.value = auto.ongkir;
        }
      }

      var ongkirAktif = isDelivery ? Math.max(0, Math.round(Number(inpOngkir.value) || 0)) : 0;
      var totalAkhir = h.subtotal + ongkirAktif;

      qtyTeksEl.textContent = h.totalQty + ' item';
      ringkasanEl.innerHTML =
        '<div><span>Subtotal (' + h.totalQty + ' item)</span><b>' + esc(rp(h.subtotal)) + '</b></div>' +
        '<div><span>Ongkir</span><b>' + (ongkirAktif > 0 ? esc(rp(ongkirAktif)) : 'GRATIS (Rp0)') + '</b></div>' +
        '<div class="edit-total"><span>Total Bayar</span><span>' + esc(rp(totalAkhir)) + '</span></div>' +
        (isDelivery && auto.gratis ? '<small>Gratis ongkir otomatis aktif (min. ' + auto.minGratis + ' item).</small>' : '');
    }

    function renderItemEditor() {
      if (!itemsEdit.length) {
        wadahItem.innerHTML = '<div class="redup" style="font-size:13px;padding:8px 2px">Belum ada item. Tambahkan minimal 1 produk di bawah.</div>';
      } else {
        wadahItem.innerHTML = itemsEdit.map(function (it, i) {
          var sub = (Number(it.harga) || 0) * (Number(it.qty) || 1);
          return '<div class="edit-item-baris">' +
            '<div class="edit-item-info">' +
              '<b>' + esc(it.nama) + (it.label ? ' (' + esc(it.label) + ')' : '') + '</b>' +
              '<small>' + esc(rp(it.harga)) + ' / pcs</small>' +
            '</div>' +
            '<div class="jumlah">' +
              '<button type="button" data-eq="' + i + '" data-d="-1" aria-label="Kurangi jumlah">−</button>' +
              '<span>' + it.qty + '</span>' +
              '<button type="button" data-eq="' + i + '" data-d="1" aria-label="Tambah jumlah">+</button>' +
            '</div>' +
            '<span class="edit-item-sub">' + esc(rp(sub)) + '</span>' +
            '<button type="button" class="edit-item-hapus" data-ehapus="' + i + '" aria-label="Hapus item">×</button>' +
          '</div>';
        }).join('');
      }
      sinkronPengirimanDanRingkasan(true);
    }

    renderItemEditor();
    sedangEdit = true;
    if (!modal.open) modal.showModal();

    selPengiriman.onchange = function () {
      ongkirManual = false;
      sinkronPengirimanDanRingkasan(true);
    };
    inpOngkir.oninput = function () {
      ongkirManual = true;
      sinkronPengirimanDanRingkasan(false);
    };

    isi.onclick = function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'tutupEditPesanan' || btn.id === 'btnBatalEdit') {
        modal.close();
        return;
      }
      if (btn.id === 'btnTambahItemEdit') {
        var selPr = $('#editPilihProduk', isi);
        var qtyIn = $('#editQtyTambah', isi);
        var prod = PRODUK.find(function (x) { return x.id === (selPr && selPr.value); });
        var qtyAdd = Math.max(1, parseInt(qtyIn && qtyIn.value, 10) || 1);
        if (!prod) return;
        var existing = itemsEdit.find(function (x) { return x.id === prod.id && !x.label; });
        if (existing) {
          existing.qty += qtyAdd;
        } else {
          itemsEdit.push({
            id: prod.id,
            nama: prod.nama,
            label: '',
            harga: Number(prod.harga) || 0,
            qty: qtyAdd
          });
        }
        if (qtyIn) qtyIn.value = '1';
        galatEl.hidden = true;
        renderItemEditor();
        return;
      }
      if (btn.dataset.eq != null) {
        var idxItem = +btn.dataset.eq;
        var delta = +btn.dataset.d;
        if (!itemsEdit[idxItem]) return;
        itemsEdit[idxItem].qty += delta;
        if (itemsEdit[idxItem].qty < 1) itemsEdit.splice(idxItem, 1);
        renderItemEditor();
        return;
      }
      if (btn.dataset.ehapus != null) {
        itemsEdit.splice(+btn.dataset.ehapus, 1);
        renderItemEditor();
      }
    };

    $('#formEditPesanan', isi).onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      var namaBaru = (f.elements.nama.value || '').trim();
      var pengirimanBaru = selPengiriman.value;
      var isDelivery = adalahPengirimanDelivery(pengirimanBaru);
      var alamatBaru = (inpAlamat.value || '').trim();
      var metodeBaru = f.elements.metode_bayar.value;
      var statusBayarBaru = f.elements.status_bayar.value;
      var statusBaru = f.elements.status.value;
      var catatanBaru = (f.elements.catatan.value || '').trim();

      if (!namaBaru) {
        galatEl.textContent = 'Nama pemesan wajib diisi.';
        galatEl.hidden = false;
        f.elements.nama.focus();
        return;
      }
      if (!itemsEdit.length) {
        galatEl.textContent = 'Pesanan harus memiliki minimal 1 item produk.';
        galatEl.hidden = false;
        return;
      }
      if (isDelivery && !alamatBaru) {
        galatEl.textContent = 'Alamat pengiriman wajib diisi untuk pesanan Delivery.';
        galatEl.hidden = false;
        inpAlamat.focus();
        return;
      }

      var h = hitungTotalItem();
      var ongkirBaru = isDelivery ? Math.max(0, Math.round(Number(inpOngkir.value) || 0)) : 0;
      var totalBaru = h.subtotal + ongkirBaru;
      var itemsSalin = itemsEdit.map(function (it) {
        return { id: it.id, nama: it.nama, label: it.label || '', harga: Number(it.harga) || 0, qty: Number(it.qty) || 1 };
      });

      var perubahan = {
        nama: namaBaru,
        pengiriman: pengirimanBaru,
        alamat: isDelivery ? alamatBaru : (alamatStan || alamatBaru),
        metode_bayar: metodeBaru,
        status_bayar: statusBayarBaru,
        status: statusBaru,
        catatan: catatanBaru,
        items: itemsSalin,
        ongkir: ongkirBaru,
        total: totalBaru
      };
      perubahan.pesan_wa = buatPesanWaAdmin(Object.assign({}, pesanan, perubahan, { subtotal: h.subtotal }));

      var btnSimpan = $('#btnSimpanEdit', isi);
      btnSimpan.disabled = true;
      btnSimpan.textContent = 'Menyimpan…';

      var targetKunci = { id: pesanan.id, kode: pesanan.kode };
      StrukKit.perbaruiPesanan(targetKunci, perubahan, TOKO).then(function (res) {
        if (!res || !res.ok) {
          btnSimpan.disabled = false;
          btnSimpan.textContent = 'Simpan Perubahan';
          galatEl.textContent = (res && res.error) ? res.error : 'Gagal menyimpan perubahan ke database. Coba lagi.';
          galatEl.hidden = false;
          toast('Gagal menyimpan ke database');
          return;
        }
        var dataBaru = (res && res.data) ? res.data : Object.assign({}, pesanan, perubahan, { subtotal: h.subtotal });
        semuaPesanan = semuaPesanan.map(function (x) {
          if ((pesanan.id != null && String(x.id) === String(pesanan.id)) || x.kode === pesanan.kode) {
            return Object.assign({}, x, dataBaru);
          }
          return x;
        });
        renderStatistik();
        renderStok();
        renderDaftar();
        sedangEdit = false;
        modal.close();
        toast('Perubahan pesanan ' + pesanan.kode + ' tersimpan permanen');
        if (res.mode === 'supabase') muatPesanan(true);
      }).catch(function (err) {
        btnSimpan.disabled = false;
        btnSimpan.textContent = 'Simpan Perubahan';
        galatEl.textContent = (err && err.message) ? err.message : 'Gagal menyimpan perubahan pesanan.';
        galatEl.hidden = false;
      });
    };
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
  if ($('#filterBayar')) $('#filterBayar').onchange = renderDaftar;

  if ($('#btnCetakLaporan')) {
    $('#btnCetakLaporan').onclick = function () {
      var list = daftarTersaring();
      StrukKit.cetakLaporanOmsetPDF(list, PRODUK, TOKO, {
        status: $('#filterStatus').value || 'Semua',
        statusBayar: ($('#filterBayar') && $('#filterBayar').value) || 'Semua',
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
        statusBayar: ($('#filterBayar') && $('#filterBayar').value) || 'Semua',
        cari: ($('#cariPesanan').value || '').trim(),
        semuaPesanan: semuaPesanan
      });
      toast('Laporan diunduh: ' + namaFile);
    };
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && sudahMasuk() && !sedangEdit) muatPesanan(true);
  });
  window.addEventListener('focus', function () {
    if (sudahMasuk() && !sedangEdit) muatPesanan(true);
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
    if (btn.dataset.edit != null) {
      var itemE = list[+btn.dataset.edit];
      if (itemE) bukaEditPesanan(itemE);
    } else if (btn.dataset.struk != null) {
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
  if ($('#editPesananModal')) {
    $('#editPesananModal').addEventListener('click', function (e) { if (e.target === this) this.close(); });
    $('#editPesananModal').addEventListener('close', function () { sedangEdit = false; });
  }

  tampilkanTampilan();
})(typeof window !== 'undefined' ? window : this);
