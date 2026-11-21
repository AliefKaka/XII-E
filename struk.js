/* Modul Struk Digital (PDF/Print & PNG Canvas) + Bukti Transfer + Stok Real-Time & Restok Admin + Laporan Omset + Integrasi Supabase / Vercel API — proyek XII-E */
(function (root) {
  'use strict';

  var KUNCI_RIWAYAT = 'katalog-riwayat-pesanan';
  var KETERANGAN_STRUK = 'Mohon simpan struk untuk bukti pemesanan dan pengambilan.';
  var KETERANGAN_STRUK_DELIVERY = 'Mohon simpan struk sebagai bukti pemesanan dan pembayaran.';
  var KETERANGAN_STRUK_COD = 'Mohon simpan struk sebagai bukti pemesanan. Pembayaran dilakukan di tempat (COD).';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function rupiah(n, mu) {
    return (mu || 'Rp') + Math.round(n || 0).toLocaleString('id-ID');
  }

  function buatKodePesanan(namaToko) {
    var awalan = String(namaToko || 'ORD').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5) || 'ORD';
    var d = new Date();
    var pad = function (x) { return String(x).padStart(2, '0'); };
    var tgl = String(d.getFullYear()).slice(-2) + pad(d.getMonth() + 1) + pad(d.getDate());
    var huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var acak = '';
    for (var i = 0; i < 4; i++) acak += huruf.charAt(Math.floor(Math.random() * huruf.length));
    return awalan + '-' + tgl + '-' + acak;
  }

  function buatKodeRestok() {
    var d = new Date();
    var pad = function (x) { return String(x).padStart(2, '0'); };
    var tgl = String(d.getFullYear()).slice(-2) + pad(d.getMonth() + 1) + pad(d.getDate());
    var huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var acak = '';
    for (var i = 0; i < 5; i++) acak += huruf.charAt(Math.floor(Math.random() * huruf.length));
    return 'RESTOK-' + tgl + '-' + acak;
  }

  function adalahRestok(row) {
    if (!row) return false;
    var st = String(row.status || '').trim().toLowerCase();
    var kd = String(row.kode || '').trim().toUpperCase();
    return st === 'restok' || kd.indexOf('RESTOK-') === 0;
  }

  function formatWaktu(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) return String(iso || '-');
    try {
      return d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      }) + ' WIB';
    } catch (e) {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  function bersihkanBaseUrl(raw) {
    return String(raw || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
  }

  function supabaseLangsungAktif(toko) {
    var sb = toko && toko.supabase;
    return !!(sb && sb.url && sb.anonKey && /^https?:\/\//i.test(sb.url.trim()));
  }

  function apiVercelAktif(toko) {
    var sb = toko && toko.supabase;
    var endpoint = (sb && sb.apiEndpoint) || '/api/pesanan';
    var pakaiHttp = typeof location !== 'undefined' && /^https?:$/i.test(location.protocol);
    return !!(endpoint && pakaiHttp);
  }

  function supabaseAktif(toko) {
    return supabaseLangsungAktif(toko) || apiVercelAktif(toko);
  }

  function urlRest(toko, query) {
    var sb = toko.supabase;
    var base = bersihkanBaseUrl(sb.url);
    var tabel = encodeURIComponent((sb.tabel || 'pesanan').trim());
    return base + '/rest/v1/' + tabel + (query || '');
  }

  function urlApiVercel(toko, query) {
    var ep = (toko && toko.supabase && toko.supabase.apiEndpoint) || '/api/pesanan';
    return ep.replace(/\/+$/, '') + (query || '');
  }

  function headerSupabase(toko, extra) {
    var key = toko.supabase.anonKey.trim();
    var h = {
      'apikey': key,
      'Content-Type': 'application/json'
    };
    if (/^eyJ/.test(key)) h['Authorization'] = 'Bearer ' + key;
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function bacaLokalMentah() {
    try {
      var raw = localStorage.getItem(KUNCI_RIWAYAT);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function bacaLokal() {
    return bacaLokalMentah().filter(function (x) { return !adalahRestok(x); });
  }

  function bacaRestokLokal() {
    return bacaLokalMentah().filter(adalahRestok);
  }

  function tulisLokal(list) {
    try {
      localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify((list || []).slice(0, 200)));
    } catch (e) {
      // Jika storage penuh karena gambar bukti, simpan ulang tanpa gambar pada riwayat lama
      try {
        var ringkas = (list || []).slice(0, 100).map(function (x, idx) {
          if (idx === 0) return x;
          var salin = Object.assign({}, x);
          salin.bukti_bayar = '';
          return salin;
        });
        localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(ringkas));
      } catch (e2) {}
    }
  }

  function simpanLokal(pesanan) {
    var list = bacaLokalMentah().filter(function (x) { return x.kode !== pesanan.kode; });
    list.unshift(pesanan);
    tulisLokal(list);
  }

  function adalahDelivery(pesanan) {
    var pg = String((pesanan && pesanan.pengiriman) || '').toLowerCase();
    var mb = String((pesanan && pesanan.metode_bayar) || '').toLowerCase();
    return pg.indexOf('delivery') > -1 || mb === 'qris dana' || mb.indexOf('cod') > -1;
  }

  function keteranganStruk(pesanan) {
    if (!adalahDelivery(pesanan)) return KETERANGAN_STRUK;
    var mb = String((pesanan && pesanan.metode_bayar) || '').toLowerCase();
    return mb.indexOf('cod') > -1 ? KETERANGAN_STRUK_COD : KETERANGAN_STRUK_DELIVERY;
  }

  function normalisasiPesanan(raw) {
    var items = raw.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    var arrItems = Array.isArray(items) ? items : [];
    var subtotalHitung = arrItems.reduce(function (s, i) { return s + (Number(i.harga) || 0) * (Number(i.qty) || 1); }, 0);
    var ongkir = Number(raw.ongkir) || 0;
    var total = raw.total != null ? Number(raw.total) : (subtotalHitung + ongkir);
    return {
      id: raw.id != null ? raw.id : null,
      kode: raw.kode || 'ORD',
      created_at: raw.created_at || raw.waktu || new Date().toISOString(),
      nama: raw.nama || '-',
      catatan: raw.catatan || '',
      pengiriman: raw.pengiriman || 'Takeaway (Ambil di Stan)',
      alamat: raw.alamat || '',
      ongkir: ongkir,
      subtotal: raw.subtotal != null ? Number(raw.subtotal) : subtotalHitung,
      metode_bayar: raw.metode_bayar || 'Bayar di Stan',
      status_bayar: raw.status_bayar || 'Belum Bayar',
      bukti_bayar: raw.bukti_bayar || '',
      items: arrItems,
      total: total,
      status: raw.status || 'Baru',
      pesan_wa: raw.pesan_wa || ''
    };
  }

  // ================= Perhitungan Stok Real-Time & Restok Admin =================
  function hitungTerjualPerProduk(pesananList) {
    var byId = {};
    var byNama = {};
    var pendapatanById = {};
    var pendapatanByNama = {};
    (pesananList || []).forEach(function (raw) {
      if (adalahRestok(raw)) return;
      var p = normalisasiPesanan(raw);
      if (String(p.status || '').toLowerCase() === 'dibatalkan') return;
      (p.items || []).forEach(function (it) {
        var qty = Math.max(0, Number(it.qty) || 0);
        var nilai = qty * (Number(it.harga) || 0);
        if (!qty) return;
        if (it.id) {
          var kId = String(it.id).trim();
          byId[kId] = (byId[kId] || 0) + qty;
          pendapatanById[kId] = (pendapatanById[kId] || 0) + nilai;
        }
        if (it.nama) {
          var kNama = String(it.nama).trim().toLowerCase();
          byNama[kNama] = (byNama[kNama] || 0) + qty;
          pendapatanByNama[kNama] = (pendapatanByNama[kNama] || 0) + nilai;
        }
      });
    });
    return {
      byId: byId,
      byNama: byNama,
      pendapatanById: pendapatanById,
      pendapatanByNama: pendapatanByNama
    };
  }

  function hitungRestokPerProduk(pesananList, restokList) {
    var byId = {};
    var byNama = {};
    var dilihat = {};
    var sumber = [].concat(restokList || [], pesananList || []);
    sumber.forEach(function (raw) {
      if (!adalahRestok(raw)) return;
      var p = normalisasiPesanan(raw);
      var kunciUnik = p.id != null ? ('id:' + p.id) : ('kode:' + p.kode);
      if (dilihat[kunciUnik]) return;
      dilihat[kunciUnik] = true;
      (p.items || []).forEach(function (it) {
        var qty = Math.round(Number(it.qty) || 0);
        if (!qty) return;
        if (it.id) {
          var kId = String(it.id).trim();
          byId[kId] = (byId[kId] || 0) + qty;
        }
        if (it.nama) {
          var kNama = String(it.nama).trim().toLowerCase();
          byNama[kNama] = (byNama[kNama] || 0) + qty;
        }
      });
    });
    return { byId: byId, byNama: byNama };
  }

  function hitungRingkasanStok(produkList, pesananList, restokList) {
    var rekap = hitungTerjualPerProduk(pesananList);
    var rekapRestok = hitungRestokPerProduk(pesananList, restokList);
    return (produkList || []).map(function (p) {
      var stokAwal = p.stokAwal != null ? Number(p.stokAwal) : Number(p.stok);
      if (isNaN(stokAwal) || stokAwal < 0) stokAwal = 0;
      var kId = String(p.id || '').trim();
      var kNama = String(p.nama || '').trim().toLowerCase();
      var pakaiId = kId && rekap.byId[kId] != null;
      var terjual = pakaiId ? rekap.byId[kId] : (rekap.byNama[kNama] || 0);
      var pendapatan = pakaiId ? (rekap.pendapatanById[kId] || 0) : (rekap.pendapatanByNama[kNama] || 0);
      var pakaiIdRestok = kId && rekapRestok.byId[kId] != null;
      var restokAdmin = pakaiIdRestok ? rekapRestok.byId[kId] : (rekapRestok.byNama[kNama] || 0);
      var stokTotal = Math.max(0, stokAwal + restokAdmin);
      var sisa = Math.max(0, stokTotal - terjual);
      var status = sisa === 0 ? 'Habis' : (sisa <= 10 ? 'Menipis' : 'Tersedia');
      return {
        id: p.id,
        nama: p.nama,
        kategori: p.kategori || 'Lainnya',
        harga: Number(p.harga) || 0,
        stokAwal: stokAwal,
        restokAdmin: restokAdmin,
        stokTotal: stokTotal,
        terjual: terjual,
        sisa: sisa,
        pendapatan: pendapatan,
        status: status
      };
    });
  }

  function terapkanStokRealTime(produkList, pesananList, restokList) {
    var ringkasan = hitungRingkasanStok(produkList, pesananList, restokList);
    (produkList || []).forEach(function (p, idx) {
      var r = ringkasan[idx];
      if (!r) return;
      if (p.stokAwal == null) p.stokAwal = r.stokAwal;
      p.restokAdmin = r.restokAdmin;
      p.terjual = r.terjual;
      p.stok = r.sisa;
    });
    return ringkasan;
  }

  function simpanRestok(produk, jumlah, catatan, toko) {
    var qty = Math.round(Number(jumlah) || 0);
    if (!produk || !qty) {
      return Promise.resolve({ ok: false, error: 'Jumlah restok tidak valid.' });
    }
    var tanda = qty > 0 ? ('+' + qty) : String(qty);
    var rec = {
      kode: buatKodeRestok(),
      created_at: new Date().toISOString(),
      nama: 'Admin (Restok)',
      catatan: catatan ? String(catatan).trim() : ('Restok ' + produk.nama + ' (' + tanda + ')'),
      pengiriman: 'Restok Admin',
      alamat: '',
      ongkir: 0,
      metode_bayar: 'Restok',
      status_bayar: 'Lunas',
      bukti_bayar: '',
      items: [{ id: produk.id, nama: produk.nama, label: 'Restok Admin', harga: 0, qty: qty }],
      total: 0,
      status: 'Restok',
      pesan_wa: ''
    };
    return simpanPesanan(rec, toko);
  }

  function resetRestokProduk(produkId, restokList, toko) {
    var targetId = String(produkId || '').trim();
    var cocok = (restokList || []).filter(function (r) {
      if (!adalahRestok(r)) return false;
      return (r.items || []).some(function (it) { return String(it.id || '').trim() === targetId; });
    });
    if (!cocok.length) return Promise.resolve({ ok: true, terhapus: 0 });
    return Promise.all(cocok.map(function (r) {
      var kunci = r.id != null ? r.id : r.kode;
      return hapusPesanan(kunci, toko);
    })).then(function (hasil) {
      var semuaOk = hasil.every(function (h) { return h && h.ok; });
      return { ok: semuaOk, terhapus: cocok.length };
    });
  }

  // ================= Laporan Omset Detail (PDF/Print & CSV/Excel) =================
  function hitungLaporanOmset(pesananList, produkList, infoFilter) {
    var semua = (pesananList || []).filter(function (r) { return !adalahRestok(r); }).map(normalisasiPesanan);
    var aktif = semua.filter(function (p) { return String(p.status || '').toLowerCase() !== 'dibatalkan'; });
    var batal = semua.filter(function (p) { return String(p.status || '').toLowerCase() === 'dibatalkan'; });

    var totalSubtotal = 0;
    var totalOngkir = 0;
    var totalOmzet = 0;
    var totalItemTerjual = 0;

    var perStatus = { Baru: 0, Diproses: 0, Selesai: 0, Dibatalkan: 0 };
    var perMetode = {};
    var perStatusBayar = { 'Lunas': { jumlah: 0, nominal: 0 }, 'Menunggu Verifikasi': { jumlah: 0, nominal: 0 }, 'Belum Bayar': { jumlah: 0, nominal: 0 } };

    semua.forEach(function (p) {
      var st = p.status || 'Baru';
      perStatus[st] = (perStatus[st] || 0) + 1;
    });

    aktif.forEach(function (p) {
      totalSubtotal += Number(p.subtotal) || 0;
      totalOngkir += Number(p.ongkir) || 0;
      totalOmzet += Number(p.total) || 0;
      (p.items || []).forEach(function (it) {
        totalItemTerjual += Number(it.qty) || 0;
      });
      var mb = p.metode_bayar || 'Bayar di Stan';
      if (!perMetode[mb]) perMetode[mb] = { jumlah: 0, nominal: 0 };
      perMetode[mb].jumlah += 1;
      perMetode[mb].nominal += Number(p.total) || 0;

      var sb = p.status_bayar || 'Belum Bayar';
      if (!perStatusBayar[sb]) perStatusBayar[sb] = { jumlah: 0, nominal: 0 };
      perStatusBayar[sb].jumlah += 1;
      perStatusBayar[sb].nominal += Number(p.total) || 0;
    });

    // Untuk rekap stok per produk, gunakan semuaPesanan & semuaRestok jika diberikan agar sisa stok selalu akurat secara global
    var sumberStok = (infoFilter && Array.isArray(infoFilter.semuaPesanan)) ? infoFilter.semuaPesanan : semua;
    var sumberRestok = (infoFilter && Array.isArray(infoFilter.semuaRestok)) ? infoFilter.semuaRestok : [];
    var rekapStokGlobal = hitungRingkasanStok(produkList || [], sumberStok, sumberRestok);
    var terjualFilter = hitungTerjualPerProduk(semua);
    var rekapProduk = rekapStokGlobal.map(function (r) {
      var kId = String(r.id || '').trim();
      var kNama = String(r.nama || '').trim().toLowerCase();
      var pakaiId = kId && terjualFilter.byId[kId] != null;
      return {
        id: r.id,
        nama: r.nama,
        kategori: r.kategori,
        harga: r.harga,
        stokAwal: r.stokAwal,
        restokAdmin: r.restokAdmin,
        stokTotal: r.stokTotal,
        terjualLaporan: pakaiId ? terjualFilter.byId[kId] : (terjualFilter.byNama[kNama] || 0),
        pendapatanLaporan: pakaiId ? (terjualFilter.pendapatanById[kId] || 0) : (terjualFilter.pendapatanByNama[kNama] || 0),
        terjualTotal: r.terjual,
        sisaStok: r.sisa,
        statusStok: r.status
      };
    });

    return {
      pesanan: semua,
      totalPesanan: semua.length,
      pesananAktif: aktif.length,
      pesananBatal: batal.length,
      totalItemTerjual: totalItemTerjual,
      totalSubtotal: totalSubtotal,
      totalOngkir: totalOngkir,
      totalOmzet: totalOmzet,
      perStatus: perStatus,
      perMetode: perMetode,
      perStatusBayar: perStatusBayar,
      rekapProduk: rekapProduk
    };
  }

  function renderLaporanOmsetHTML(pesananList, produkList, toko, infoFilter) {
    var lap = hitungLaporanOmset(pesananList, produkList, infoFilter);
    var mu = (toko && toko.mataUang) || 'Rp';
    var namaToko = (toko && toko.nama) || 'D SECO';
    var alamatStan = (toko && toko.lokasi && toko.lokasi.alamat) || '';
    var filterStatus = (infoFilter && infoFilter.status) || 'Semua';
    var filterCari = (infoFilter && infoFilter.cari) || '';
    var waktuCetak = formatWaktu(new Date().toISOString());

    var barisMetode = Object.keys(lap.perMetode).length
      ? Object.keys(lap.perMetode).map(function (k) {
          var m = lap.perMetode[k];
          return '<tr><td>' + esc(k) + '</td><td class="num">' + m.jumlah + '</td><td class="num">' + esc(rupiah(m.nominal, mu)) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="3" class="kosong-sel">Belum ada transaksi aktif</td></tr>';

    var barisBayar = Object.keys(lap.perStatusBayar).map(function (k) {
      var b = lap.perStatusBayar[k];
      return '<tr><td>' + esc(k) + '</td><td class="num">' + b.jumlah + '</td><td class="num">' + esc(rupiah(b.nominal, mu)) + '</td></tr>';
    }).join('');

    var barisProduk = lap.rekapProduk.length
      ? lap.rekapProduk.map(function (r) {
          var restokTeks = r.restokAdmin > 0 ? ('+' + r.restokAdmin) : String(r.restokAdmin || 0);
          return '<tr>' +
            '<td><b>' + esc(r.nama) + '</b><br><small>' + esc(r.kategori) + '</small></td>' +
            '<td class="num">' + esc(rupiah(r.harga, mu)) + '</td>' +
            '<td class="num">' + r.stokAwal + '</td>' +
            '<td class="num">' + esc(restokTeks) + '</td>' +
            '<td class="num">' + r.terjualLaporan + '</td>' +
            '<td class="num"><b>' + r.sisaStok + '</b> (' + esc(r.statusStok) + ')</td>' +
            '<td class="num"><b>' + esc(rupiah(r.pendapatanLaporan, mu)) + '</b></td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="7" class="kosong-sel">Tidak ada data produk</td></tr>';

    var barisPesanan = lap.pesanan.length
      ? lap.pesanan.map(function (p, idx) {
          var isBatal = String(p.status || '').toLowerCase() === 'dibatalkan';
          var rincian = (p.items || []).map(function (it) {
            return esc(it.qty) + 'x ' + esc(it.nama) + (it.label ? ' (' + esc(it.label) + ')' : '');
          }).join('<br>');
          return '<tr class="' + (isBatal ? 'baris-batal' : '') + '">' +
            '<td class="num">' + (idx + 1) + '</td>' +
            '<td><b>' + esc(p.kode) + '</b><br><small>' + esc(formatWaktu(p.created_at)) + '</small></td>' +
            '<td><b>' + esc(p.nama) + '</b><br><small>' + esc(p.pengiriman) + '</small>' +
              (p.alamat && adalahDelivery(p) ? '<br><small>' + esc(p.alamat) + '</small>' : '') +
              (p.catatan ? '<br><small>Cat: ' + esc(p.catatan) + '</small>' : '') +
            '</td>' +
            '<td>' + (rincian || '-') + '</td>' +
            '<td>' + esc(p.metode_bayar) + '<br><small>' + esc(p.status_bayar) + '</small></td>' +
            '<td><b>' + esc(p.status) + '</b></td>' +
            '<td class="num">' + esc(rupiah(p.subtotal, mu)) + '</td>' +
            '<td class="num">' + (p.ongkir > 0 ? esc(rupiah(p.ongkir, mu)) : 'Rp0') + '</td>' +
            '<td class="num"><b>' + esc(rupiah(p.total, mu)) + '</b></td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="9" class="kosong-sel">Belum ada data pesanan masuk</td></tr>';

    return '<div class="laporan-kertas">' +
      '<div class="laporan-kepala">' +
        '<div>' +
          '<span class="struk-lencana">LAPORAN OMSET &amp; PESANAN</span>' +
          '<h1>' + esc(namaToko) + '</h1>' +
          (alamatStan ? '<p>' + esc(alamatStan) + '</p>' : '') +
        '</div>' +
        '<div class="laporan-meta">' +
          '<div><span>Waktu Cetak</span><b>' + esc(waktuCetak) + '</b></div>' +
          '<div><span>Filter Status</span><b>' + esc(filterStatus) + '</b></div>' +
          (filterCari ? '<div><span>Kata Kunci</span><b>' + esc(filterCari) + '</b></div>' : '') +
        '</div>' +
      '</div>' +

      '<div class="laporan-ringkas-grid">' +
        '<div class="laporan-box"><span>Total Pesanan</span><b>' + lap.totalPesanan + '</b><small>Aktif: ' + lap.pesananAktif + ' · Batal: ' + lap.pesananBatal + '</small></div>' +
        '<div class="laporan-box"><span>Total Item Terjual</span><b>' + lap.totalItemTerjual + ' pcs</b><small>Pesanan non-batal</small></div>' +
        '<div class="laporan-box"><span>Subtotal Produk</span><b>' + esc(rupiah(lap.totalSubtotal, mu)) + '</b><small>Ongkir: ' + esc(rupiah(lap.totalOngkir, mu)) + '</small></div>' +
        '<div class="laporan-box utama"><span>Total Omzet Bersih</span><b>' + esc(rupiah(lap.totalOmzet, mu)) + '</b><small>Tidak termasuk dibatalkan</small></div>' +
      '</div>' +

      '<div class="laporan-dua-kolom">' +
        '<div>' +
          '<h3>Rincian per Metode Pembayaran</h3>' +
          '<table class="laporan-tabel"><thead><tr><th>Metode</th><th class="num">Pesanan</th><th class="num">Omzet</th></tr></thead><tbody>' + barisMetode + '</tbody></table>' +
        '</div>' +
        '<div>' +
          '<h3>Rincian Status Pembayaran</h3>' +
          '<table class="laporan-tabel"><thead><tr><th>Status Bayar</th><th class="num">Pesanan</th><th class="num">Nominal</th></tr></thead><tbody>' + barisBayar + '</tbody></table>' +
        '</div>' +
      '</div>' +

      '<h3>Rekap Penjualan &amp; Sisa Stok Produk</h3>' +
      '<table class="laporan-tabel">' +
        '<thead><tr><th>Produk</th><th class="num">Harga</th><th class="num">Stok Awal</th><th class="num">Restok Admin</th><th class="num">Terjual</th><th class="num">Sisa Stok</th><th class="num">Pendapatan</th></tr></thead>' +
        '<tbody>' + barisProduk + '</tbody>' +
      '</table>' +

      '<h3>Daftar Detail Pesanan Masuk</h3>' +
      '<table class="laporan-tabel laporan-tabel-detail">' +
        '<thead><tr><th class="num">No</th><th>Kode &amp; Waktu</th><th>Pemesan &amp; Pengiriman</th><th>Rincian Produk</th><th>Pembayaran</th><th>Status</th><th class="num">Subtotal</th><th class="num">Ongkir</th><th class="num">Total</th></tr></thead>' +
        '<tbody>' + barisPesanan + '</tbody>' +
        '<tfoot><tr><td colspan="6"><b>TOTAL OMZET AKTIF (' + lap.pesananAktif + ' pesanan)</b></td><td class="num"><b>' + esc(rupiah(lap.totalSubtotal, mu)) + '</b></td><td class="num"><b>' + esc(rupiah(lap.totalOngkir, mu)) + '</b></td><td class="num"><b>' + esc(rupiah(lap.totalOmzet, mu)) + '</b></td></tr></tfoot>' +
      '</table>' +
    '</div>';
  }

  function cetakLaporanOmsetPDF(pesananList, produkList, toko, infoFilter) {
    var area = document.getElementById('areaCetakLaporan');
    if (!area) {
      area = document.createElement('div');
      area.id = 'areaCetakLaporan';
      area.className = 'area-cetak-laporan';
      document.body.appendChild(area);
    }
    area.innerHTML = renderLaporanOmsetHTML(pesananList, produkList, toko, infoFilter);
    document.body.classList.add('sedang-cetak-laporan');
    var bersihkan = function () {
      document.body.classList.remove('sedang-cetak-laporan');
      window.removeEventListener('afterprint', bersihkan);
    };
    window.addEventListener('afterprint', bersihkan);
    setTimeout(function () {
      window.print();
      setTimeout(bersihkan, 1500);
    }, 60);
  }

  function csvSel(val) {
    var s = String(val == null ? '' : val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buatLaporanCSV(pesananList, produkList, toko, infoFilter) {
    var lap = hitungLaporanOmset(pesananList, produkList, infoFilter);
    var namaToko = (toko && toko.nama) || 'D SECO';
    var filterStatus = (infoFilter && infoFilter.status) || 'Semua';
    var filterCari = (infoFilter && infoFilter.cari) || '';
    var baris = [];

    baris.push(['LAPORAN OMSET & DATA PESANAN MASUK', namaToko]);
    baris.push(['Waktu Unduh', formatWaktu(new Date().toISOString())]);
    baris.push(['Filter Status', filterStatus]);
    if (filterCari) baris.push(['Kata Kunci', filterCari]);
    baris.push([]);

    baris.push(['RINGKASAN OMSET']);
    baris.push(['Total Pesanan', lap.totalPesanan]);
    baris.push(['Pesanan Aktif (Non-Batal)', lap.pesananAktif]);
    baris.push(['Pesanan Dibatalkan', lap.pesananBatal]);
    baris.push(['Total Item Terjual', lap.totalItemTerjual]);
    baris.push(['Total Subtotal Produk (Rp)', lap.totalSubtotal]);
    baris.push(['Total Ongkir (Rp)', lap.totalOngkir]);
    baris.push(['Total Omzet Bersih (Rp)', lap.totalOmzet]);
    baris.push([]);

    baris.push(['REKAP PENJUALAN & SISA STOK PRODUK']);
    baris.push(['ID Produk', 'Nama Produk', 'Kategori', 'Harga Satuan', 'Stok Awal (produk.js)', 'Restok Admin', 'Terjual (Sesuai Filter)', 'Total Terjual Global', 'Sisa Stok', 'Status Stok', 'Pendapatan (Rp)']);
    lap.rekapProduk.forEach(function (r) {
      baris.push([r.id, r.nama, r.kategori, r.harga, r.stokAwal, r.restokAdmin, r.terjualLaporan, r.terjualTotal, r.sisaStok, r.statusStok, r.pendapatanLaporan]);
    });
    baris.push([]);

    baris.push(['DAFTAR DETAIL PESANAN MASUK']);
    baris.push(['No', 'Kode Pesanan', 'Waktu', 'Nama Pemesan', 'Pengiriman', 'Alamat', 'Metode Pembayaran', 'Status Pembayaran', 'Status Pesanan', 'Rincian Produk', 'Total Qty', 'Subtotal (Rp)', 'Ongkir (Rp)', 'Total Bayar (Rp)', 'Catatan']);
    lap.pesanan.forEach(function (p, idx) {
      var rincian = (p.items || []).map(function (it) {
        return (it.qty || 1) + 'x ' + it.nama + (it.label ? ' (' + it.label + ')' : '') + ' @' + (it.harga || 0);
      }).join(' | ');
      var qtyTot = (p.items || []).reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0);
      baris.push([
        idx + 1,
        p.kode,
        formatWaktu(p.created_at),
        p.nama,
        p.pengiriman,
        p.alamat,
        p.metode_bayar,
        p.status_bayar,
        p.status,
        rincian,
        qtyTot,
        p.subtotal,
        p.ongkir,
        p.total,
        p.catatan
      ]);
    });

    return '\uFEFF' + baris.map(function (r) { return r.map(csvSel).join(','); }).join('\r\n');
  }

  function unduhLaporanCSV(pesananList, produkList, toko, infoFilter) {
    var csv = buatLaporanCSV(pesananList, produkList, toko, infoFilter);
    var d = new Date();
    var pad = function (x) { return String(x).padStart(2, '0'); };
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    var slug = String((toko && toko.nama) || 'toko').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var namaFile = 'laporan-omset-' + slug + '-' + stamp + '.csv';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = namaFile;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    return namaFile;
  }

  function simpanPesanan(pesanan, toko) {
    simpanLokal(pesanan);
    if (!supabaseAktif(toko) || typeof fetch !== 'function') {
      return Promise.resolve({ ok: true, mode: 'lokal', data: pesanan });
    }
    var payload = {
      kode: pesanan.kode,
      nama: pesanan.nama,
      catatan: pesanan.catatan || '',
      pengiriman: pesanan.pengiriman || 'Takeaway (Ambil di Stan)',
      alamat: pesanan.alamat || '',
      ongkir: Math.round(pesanan.ongkir || 0),
      metode_bayar: pesanan.metode_bayar || 'Bayar di Stan',
      status_bayar: pesanan.status_bayar || 'Belum Bayar',
      bukti_bayar: pesanan.bukti_bayar || '',
      items: pesanan.items || [],
      total: Math.round(pesanan.total || 0),
      status: pesanan.status || 'Baru',
      pesan_wa: pesanan.pesan_wa || ''
    };
    var langsung = supabaseLangsungAktif(toko);
    var target = langsung ? urlRest(toko) : urlApiVercel(toko);
    var headers = langsung
      ? headerSupabase(toko, { 'Prefer': 'return=representation' })
      : { 'Content-Type': 'application/json' };

    return fetch(target, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ': ' + t); });
      }
      return r.json();
    }).then(function (rows) {
      var saved = Array.isArray(rows) && rows[0] ? rows[0] : (rows || pesanan);
      if (saved.id != null) {
        pesanan.id = saved.id;
        pesanan.created_at = saved.created_at || pesanan.created_at;
        simpanLokal(pesanan);
      }
      return { ok: true, mode: 'supabase', data: pesanan };
    }).catch(function (err) {
      return { ok: false, mode: 'lokal', data: pesanan, error: err && err.message ? err.message : String(err) };
    });
  }

  function pisahPesananDanRestok(rows) {
    var normal = (Array.isArray(rows) ? rows : []).map(normalisasiPesanan);
    var pesanan = [];
    var restok = [];
    normal.forEach(function (r) {
      if (adalahRestok(r)) restok.push(r);
      else pesanan.push(r);
    });
    return { pesanan: pesanan, restok: restok };
  }

  function ambilSemuaPesanan(toko) {
    if (!supabaseAktif(toko) || typeof fetch !== 'function') {
      var lokal = pisahPesananDanRestok(bacaLokalMentah());
      return Promise.resolve({ ok: true, mode: 'lokal', data: lokal.pesanan, restok: lokal.restok });
    }
    var langsung = supabaseLangsungAktif(toko);
    var target = langsung ? urlRest(toko, '?select=*&order=created_at.desc') : urlApiVercel(toko);
    var headers = langsung ? headerSupabase(toko) : { 'Accept': 'application/json' };

    return fetch(target, {
      method: 'GET',
      headers: headers
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ': ' + t); });
      }
      return r.json();
    }).then(function (rows) {
      var hasil = pisahPesananDanRestok(rows);
      return { ok: true, mode: 'supabase', data: hasil.pesanan, restok: hasil.restok };
    }).catch(function (err) {
      var lokal = pisahPesananDanRestok(bacaLokalMentah());
      return { ok: false, mode: 'lokal', data: lokal.pesanan, restok: lokal.restok, error: err && err.message ? err.message : String(err) };
    });
  }

  function patchPesanan(idAtauKode, perubahan, toko) {
    var list = bacaLokalMentah();
    list.forEach(function (x) {
      if (String(x.id) === String(idAtauKode) || x.kode === idAtauKode) {
        Object.keys(perubahan).forEach(function (k) { x[k] = perubahan[k]; });
      }
    });
    tulisLokal(list);

    if (!supabaseAktif(toko) || typeof fetch !== 'function') {
      return Promise.resolve({ ok: true, mode: 'lokal' });
    }
    var isNumericId = typeof idAtauKode === 'number' || /^\d+$/.test(String(idAtauKode));
    var langsung = supabaseLangsungAktif(toko);
    var target = langsung
      ? urlRest(toko, isNumericId ? '?id=eq.' + encodeURIComponent(idAtauKode) : '?kode=eq.' + encodeURIComponent(idAtauKode))
      : urlApiVercel(toko, isNumericId ? '?id=' + encodeURIComponent(idAtauKode) : '?kode=' + encodeURIComponent(idAtauKode));
    var headers = langsung
      ? headerSupabase(toko, { 'Prefer': 'return=representation' })
      : { 'Content-Type': 'application/json' };

    return fetch(target, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(perubahan)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ': ' + t); });
      return { ok: true, mode: 'supabase' };
    }).catch(function (err) {
      return { ok: false, mode: 'lokal', error: err && err.message ? err.message : String(err) };
    });
  }

  function ubahStatusPesanan(idAtauKode, statusBaru, toko) {
    return patchPesanan(idAtauKode, { status: statusBaru }, toko);
  }

  function ubahStatusBayar(idAtauKode, statusBayarBaru, toko) {
    return patchPesanan(idAtauKode, { status_bayar: statusBayarBaru }, toko);
  }

  function hapusPesanan(idAtauKode, toko) {
    var list = bacaLokalMentah().filter(function (x) {
      return String(x.id) !== String(idAtauKode) && x.kode !== idAtauKode;
    });
    tulisLokal(list);

    if (!supabaseAktif(toko) || typeof fetch !== 'function') {
      return Promise.resolve({ ok: true, mode: 'lokal' });
    }
    var isNumericId = typeof idAtauKode === 'number' || /^\d+$/.test(String(idAtauKode));
    var langsung = supabaseLangsungAktif(toko);
    var target = langsung
      ? urlRest(toko, isNumericId ? '?id=eq.' + encodeURIComponent(idAtauKode) : '?kode=eq.' + encodeURIComponent(idAtauKode))
      : urlApiVercel(toko, isNumericId ? '?id=' + encodeURIComponent(idAtauKode) : '?kode=' + encodeURIComponent(idAtauKode));
    var headers = langsung ? headerSupabase(toko) : { 'Accept': 'application/json' };

    return fetch(target, {
      method: 'DELETE',
      headers: headers
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ': ' + t); });
      return { ok: true, mode: 'supabase' };
    }).catch(function (err) {
      return { ok: false, mode: 'lokal', error: err && err.message ? err.message : String(err) };
    });
  }

  function kompresGambar(file, maxLebar, kualitas) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve('');
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Gagal membaca gambar')); };
      reader.onload = function (ev) {
        var img = new Image();
        img.onerror = function () { resolve(ev.target.result || ''); };
        img.onload = function () {
          var batas = maxLebar || 720;
          var w = img.width, h = img.height;
          if (w > batas) {
            h = Math.round(h * (batas / w));
            w = batas;
          }
          var c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(c.toDataURL('image/jpeg', kualitas || 0.72));
          } catch (e) {
            resolve(ev.target.result || '');
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function dataUrlKeFile(dataUrl, namaFile) {
    if (!dataUrl || typeof File !== 'function') return null;
    try {
      var bagian = dataUrl.split(',');
      var mimeMatch = bagian[0].match(/:(.*?);/);
      var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      var bin = atob(bagian[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], namaFile || 'bukti-transfer.jpg', { type: mime });
    } catch (e) {
      return null;
    }
  }

  function renderStrukHTML(pesanan, toko) {
    var p = normalisasiPesanan(pesanan);
    var mu = (toko && toko.mataUang) || 'Rp';
    var namaToko = (toko && toko.nama) || 'D SECO';
    var alamatStan = (toko && toko.lokasi && toko.lokasi.alamat) || '';
    var jamBuka = (toko && toko.lokasi && toko.lokasi.jamBuka) || '';
    var delivery = adalahDelivery(p);
    var barisItem = p.items.map(function (it) {
      var sub = (it.harga || 0) * (it.qty || 1);
      return '<div class="struk-item">' +
        '<div class="struk-item-kiri"><b>' + esc(it.nama) + '</b>' +
        (it.label ? '<small>' + esc(it.label) + '</small>' : '') +
        '<small>' + esc(it.qty) + ' x ' + esc(rupiah(it.harga, mu)) + '</small></div>' +
        '<div class="struk-item-kanan">' + esc(rupiah(sub, mu)) + '</div>' +
      '</div>';
    }).join('');

    var barisRingkas = '';
    if (delivery) {
      barisRingkas =
        '<div class="struk-subbaris"><span>Subtotal</span><span>' + esc(rupiah(p.subtotal, mu)) + '</span></div>' +
        '<div class="struk-subbaris"><span>Ongkir</span><span>' + (p.ongkir > 0 ? esc(rupiah(p.ongkir, mu)) : 'GRATIS') + '</span></div>';
    }

    return '<div class="struk-kertas">' +
      '<div class="struk-kepala">' +
        '<span class="struk-lencana">STRUK PEMESANAN</span>' +
        '<h3>' + esc(namaToko) + '</h3>' +
        (alamatStan ? '<p class="struk-alamat">' + esc(alamatStan) + '</p>' : '') +
        (jamBuka ? '<p class="struk-alamat">Jam buka: ' + esc(jamBuka) + '</p>' : '') +
      '</div>' +
      '<div class="struk-meta">' +
        '<div><span>Kode Pesanan</span><b>' + esc(p.kode) + '</b></div>' +
        '<div><span>Tanggal</span><b>' + esc(formatWaktu(p.created_at)) + '</b></div>' +
        '<div><span>Pemesan</span><b>' + esc(p.nama) + '</b></div>' +
        '<div><span>Pengiriman</span><b>' + esc(p.pengiriman) + '</b></div>' +
        (delivery && p.alamat ? '<div><span>Alamat Kirim</span><b>' + esc(p.alamat) + '</b></div>' : '') +
        '<div><span>Pembayaran</span><b>' + esc(p.metode_bayar) + '</b></div>' +
        (p.catatan ? '<div><span>Catatan</span><b>' + esc(p.catatan) + '</b></div>' : '') +
      '</div>' +
      '<div class="struk-daftar">' + barisItem + '</div>' +
      barisRingkas +
      '<div class="struk-total">' +
        '<span>TOTAL BAYAR</span><strong>' + esc(rupiah(p.total, mu)) + '</strong>' +
      '</div>' +
      '<div class="struk-peringatan">' +
        '<b>Penting:</b> ' + esc(keteranganStruk(p)) +
      '</div>' +
    '</div>';
  }

  function bungkusTeks(ctx, teks, maxLebar) {
    var kata = String(teks || '').split(/\s+/);
    var baris = [], aktif = '';
    kata.forEach(function (k) {
      var uji = aktif ? aktif + ' ' + k : k;
      if (ctx.measureText(uji).width > maxLebar && aktif) {
        baris.push(aktif);
        aktif = k;
      } else {
        aktif = uji;
      }
    });
    if (aktif) baris.push(aktif);
    return baris.length ? baris : [''];
  }

  function gambarStrukCanvas(pesanan, toko) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') return reject(new Error('Canvas hanya tersedia di browser'));
      var p = normalisasiPesanan(pesanan);
      var mu = (toko && toko.mataUang) || 'Rp';
      var namaToko = (toko && toko.nama) || 'D SECO';
      var alamatStan = (toko && toko.lokasi && toko.lokasi.alamat) || '';
      var delivery = adalahDelivery(p);
      var W = 720, PAD = 44, CW = W - PAD * 2;

      var ukur = document.createElement('canvas').getContext('2d');
      ukur.font = '400 20px "DM Sans", system-ui, sans-serif';
      var barisAlamat = alamatStan ? bungkusTeks(ukur, alamatStan, CW) : [];
      var barisAlamatKirim = (delivery && p.alamat) ? bungkusTeks(ukur, 'Alamat Kirim: ' + p.alamat, CW) : [];
      var barisCatatan = p.catatan ? bungkusTeks(ukur, 'Catatan: ' + p.catatan, CW) : [];
      var teksPeringatan = 'Penting: ' + keteranganStruk(p);
      var barisPeringatan = bungkusTeks(ukur, teksPeringatan, CW - 36);

      var tinggiItem = 0;
      p.items.forEach(function (it) {
        tinggiItem += 32 + (it.label ? 24 : 0) + 26 + 18;
      });

      var tinggiSub = delivery ? 68 : 0;
      var H = 190 + barisAlamat.length * 26 + 195 + barisAlamatKirim.length * 26 + barisCatatan.length * 26 + 34 + tinggiItem + tinggiSub + 95 + (barisPeringatan.length * 28 + 44) + 56;
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = Math.max(580, H);
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, canvas.height);

      ctx.strokeStyle = '#d7ddd4';
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 16, W - 32, canvas.height - 32);

      var y = 66;
      ctx.fillStyle = '#e8ebe5';
      ctx.fillRect(W / 2 - 120, y - 24, 240, 34);
      ctx.fillStyle = '#3b4a3e';
      ctx.font = '700 15px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STRUK PEMESANAN', W / 2, y - 2);
      y += 42;

      ctx.fillStyle = '#1b1d1a';
      ctx.font = '800 34px "DM Sans", system-ui, sans-serif';
      ctx.fillText(namaToko, W / 2, y);
      y += 30;

      ctx.fillStyle = '#555c54';
      ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
      barisAlamat.forEach(function (b) {
        ctx.fillText(b, W / 2, y);
        y += 24;
      });

      function garisPutus(posY) {
        ctx.save();
        ctx.strokeStyle = '#c5cdc2';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(PAD, posY);
        ctx.lineTo(W - PAD, posY);
        ctx.stroke();
        ctx.restore();
      }

      y += 14;
      garisPutus(y);
      y += 34;

      var meta = [
        ['Kode Pesanan', p.kode],
        ['Tanggal', formatWaktu(p.created_at)],
        ['Pemesan', p.nama],
        ['Pengiriman', p.pengiriman],
        ['Pembayaran', p.metode_bayar]
      ];
      meta.forEach(function (row) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#5c635b';
        ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
        ctx.fillText(row[0], PAD, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#1b1d1a';
        ctx.font = '700 19px "DM Sans", system-ui, sans-serif';
        ctx.fillText(row[1], W - PAD, y);
        y += 32;
      });

      if (barisAlamatKirim.length) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#474f46';
        ctx.font = '500 18px "DM Sans", system-ui, sans-serif';
        barisAlamatKirim.forEach(function (b) {
          ctx.fillText(b, PAD, y);
          y += 26;
        });
      }

      if (barisCatatan.length) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#474f46';
        ctx.font = '500 18px "DM Sans", system-ui, sans-serif';
        barisCatatan.forEach(function (b) {
          ctx.fillText(b, PAD, y);
          y += 26;
        });
      }

      y += 10;
      garisPutus(y);
      y += 34;

      p.items.forEach(function (it) {
        var sub = (it.harga || 0) * (it.qty || 1);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#1b1d1a';
        ctx.font = '700 21px "DM Sans", system-ui, sans-serif';
        ctx.fillText(it.nama, PAD, y);

        ctx.textAlign = 'right';
        ctx.fillText(rupiah(sub, mu), W - PAD, y);
        y += 26;

        ctx.textAlign = 'left';
        ctx.fillStyle = '#5c635b';
        ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
        if (it.label) {
          ctx.fillText(it.label, PAD, y);
          y += 24;
        }
        ctx.fillText((it.qty || 1) + ' x ' + rupiah(it.harga, mu), PAD, y);
        y += 34;
      });

      garisPutus(y);
      y += 34;

      if (delivery) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#5c635b';
        ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
        ctx.fillText('Subtotal', PAD, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#1b1d1a';
        ctx.font = '700 19px "DM Sans", system-ui, sans-serif';
        ctx.fillText(rupiah(p.subtotal, mu), W - PAD, y);
        y += 30;

        ctx.textAlign = 'left';
        ctx.fillStyle = '#5c635b';
        ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
        ctx.fillText('Ongkir', PAD, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = p.ongkir > 0 ? '#1b1d1a' : '#177a41';
        ctx.font = '700 19px "DM Sans", system-ui, sans-serif';
        ctx.fillText(p.ongkir > 0 ? rupiah(p.ongkir, mu) : 'GRATIS', W - PAD, y);
        y += 36;
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1b1d1a';
      ctx.font = '800 24px "DM Sans", system-ui, sans-serif';
      ctx.fillText('TOTAL BAYAR', PAD, y);
      ctx.textAlign = 'right';
      ctx.font = '800 28px "DM Sans", system-ui, sans-serif';
      ctx.fillText(rupiah(p.total, mu), W - PAD, y);
      y += 34;

      var kotakH = barisPeringatan.length * 28 + 34;
      ctx.fillStyle = '#eef3ec';
      ctx.fillRect(PAD, y, CW, kotakH);
      ctx.strokeStyle = '#6f8f74';
      ctx.lineWidth = 2;
      ctx.strokeRect(PAD, y, CW, kotakH);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#1f3623';
      ctx.font = '700 19px "DM Sans", system-ui, sans-serif';
      var py = y + 32;
      barisPeringatan.forEach(function (b) {
        ctx.fillText(b, W / 2, py);
        py += 28;
      });

      canvas.toBlob(function (blob) {
        if (!blob) return reject(new Error('Gagal membuat gambar struk'));
        resolve(blob);
      }, 'image/png');
    });
  }

  function unduhStrukPNG(pesanan, toko) {
    var p = normalisasiPesanan(pesanan);
    return gambarStrukCanvas(p, toko).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'struk-' + p.kode.toLowerCase() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return blob;
    });
  }

  function bagikanStrukKeWA(pesanan, toko, linkWAUrl) {
    var p = normalisasiPesanan(pesanan);
    return gambarStrukCanvas(p, toko).then(function (blob) {
      var file = typeof File === 'function'
        ? new File([blob], 'struk-' + p.kode.toLowerCase() + '.png', { type: 'image/png' })
        : null;
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({
          title: 'Struk Pesanan ' + p.kode,
          text: p.pesan_wa || ('Struk Pesanan ' + p.kode),
          files: [file]
        }).then(function () {
          return { metode: 'share' };
        }).catch(function (err) {
          if (err && err.name === 'AbortError') return { metode: 'batal' };
          return fallbackUnduhDanWA(blob, p, linkWAUrl);
        });
      }
      return fallbackUnduhDanWA(blob, p, linkWAUrl);
    });
  }

  function bagikanBuktiKeWA(pesanan, fileBukti, linkWAUrl) {
    var p = normalisasiPesanan(pesanan);
    var file = fileBukti || dataUrlKeFile(p.bukti_bayar, 'bukti-' + p.kode.toLowerCase() + '.jpg');
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({
        title: 'Bukti Transfer ' + p.kode,
        text: p.pesan_wa || ('Pesanan ' + p.kode),
        files: [file]
      }).then(function () {
        return { metode: 'share' };
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return { metode: 'batal' };
        return fallbackBuktiDanWA(file, p, linkWAUrl);
      });
    }
    return Promise.resolve(fallbackBuktiDanWA(file, p, linkWAUrl));
  }

  function fallbackBuktiDanWA(file, p, linkWAUrl) {
    if (file) {
      var url = URL.createObjectURL(file);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bukti-transfer-' + p.kode.toLowerCase() + '.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    if (linkWAUrl) window.open(linkWAUrl, '_blank', 'noopener');
    return { metode: 'fallback' };
  }

  function fallbackUnduhDanWA(blob, p, linkWAUrl) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'struk-' + p.kode.toLowerCase() + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    if (linkWAUrl) window.open(linkWAUrl, '_blank', 'noopener');
    return { metode: 'fallback' };
  }

  function cetakStrukPDF(pesanan, toko) {
    var area = document.getElementById('areaCetakStruk');
    if (!area) {
      area = document.createElement('div');
      area.id = 'areaCetakStruk';
      area.className = 'area-cetak';
      document.body.appendChild(area);
    }
    area.innerHTML = renderStrukHTML(pesanan, toko);
    document.body.classList.add('sedang-cetak');
    var bersihkan = function () {
      document.body.classList.remove('sedang-cetak');
      window.removeEventListener('afterprint', bersihkan);
    };
    window.addEventListener('afterprint', bersihkan);
    setTimeout(function () {
      window.print();
      setTimeout(bersihkan, 1200);
    }, 60);
  }

  var API = {
    KETERANGAN_STRUK: KETERANGAN_STRUK,
    KETERANGAN_STRUK_DELIVERY: KETERANGAN_STRUK_DELIVERY,
    buatKodePesanan: buatKodePesanan,
    buatKodeRestok: buatKodeRestok,
    adalahRestok: adalahRestok,
    formatWaktu: formatWaktu,
    bersihkanBaseUrl: bersihkanBaseUrl,
    supabaseAktif: supabaseAktif,
    bacaLokal: bacaLokal,
    bacaRestokLokal: bacaRestokLokal,
    simpanPesanan: simpanPesanan,
    simpanRestok: simpanRestok,
    resetRestokProduk: resetRestokProduk,
    ambilSemuaPesanan: ambilSemuaPesanan,
    ubahStatusPesanan: ubahStatusPesanan,
    ubahStatusBayar: ubahStatusBayar,
    hapusPesanan: hapusPesanan,
    normalisasiPesanan: normalisasiPesanan,
    hitungTerjualPerProduk: hitungTerjualPerProduk,
    hitungRestokPerProduk: hitungRestokPerProduk,
    hitungRingkasanStok: hitungRingkasanStok,
    terapkanStokRealTime: terapkanStokRealTime,
    hitungLaporanOmset: hitungLaporanOmset,
    renderLaporanOmsetHTML: renderLaporanOmsetHTML,
    cetakLaporanOmsetPDF: cetakLaporanOmsetPDF,
    buatLaporanCSV: buatLaporanCSV,
    unduhLaporanCSV: unduhLaporanCSV,
    kompresGambar: kompresGambar,
    dataUrlKeFile: dataUrlKeFile,
    renderStrukHTML: renderStrukHTML,
    gambarStrukCanvas: gambarStrukCanvas,
    unduhStrukPNG: unduhStrukPNG,
    bagikanStrukKeWA: bagikanStrukKeWA,
    bagikanBuktiKeWA: bagikanBuktiKeWA,
    cetakStrukPDF: cetakStrukPDF
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
    return;
  }
  root.StrukKit = API;
})(typeof window !== 'undefined' ? window : this);