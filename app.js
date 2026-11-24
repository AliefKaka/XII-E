/* kredit-maliki: Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id. Lisensi Nonkomersial Maliki Studio: wajib kredit, dilarang dijual (lihat LICENSE). */
/* Katalog Toko WA — Maliki Studio (malikisaputra.biz.id). Lisensi Nonkomersial Maliki Studio. */
(function (root) {
  'use strict';

  var OPSI_PENGIRIMAN_DEFAULT = [
    { id: 'takeaway', label: 'Takeaway (Ambil di Stan)', ongkir: 0, delivery: false },
    { id: 'lumajang-kota', label: 'Delivery — Lumajang Kota', ongkir: 3000, delivery: true },
    { id: 'lain', label: 'Delivery — Lainnya', ongkir: 5000, delivery: true }
  ];

  // ================= Logika murni (bisa diuji di Node) =================
  function rupiah(n, mu) { return (mu || 'Rp') + Math.round(n || 0).toLocaleString('id-ID'); }

  /** Harga satu produk sesuai pilihan varian ({Ukuran:'XL'}) */
  function hargaVarian(p, pilihan) {
    var h = p.harga;
    (p.varian || []).forEach(function (v) { var o = pilihan && pilihan[v.nama]; if (o && v.tambah && v.tambah[o]) h += v.tambah[o]; });
    return h;
  }

  function daftarPengiriman(toko) {
    var list = toko && toko.pengiriman && Array.isArray(toko.pengiriman.opsi) && toko.pengiriman.opsi.length
      ? toko.pengiriman.opsi
      : OPSI_PENGIRIMAN_DEFAULT;
    return list;
  }

  function cariPengiriman(id, toko) {
    var list = daftarPengiriman(toko);
    return list.find(function (o) { return o.id === id; }) || list[0];
  }

  function hitungTotal(items, pengirimanId, toko) {
    var subtotal = items.reduce(function (s, i) { return s + i.harga * i.qty; }, 0);
    var totalQty = items.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
    var opsi = cariPengiriman(pengirimanId || 'takeaway', toko);
    var minGratis = (toko && toko.pengiriman && Number(toko.pengiriman.minGratisOngkir)) || 5;
    var delivery = !!opsi.delivery;
    var ongkirAsli = delivery ? (Number(opsi.ongkir) || 0) : 0;
    var gratisOngkir = delivery && totalQty >= minGratis;
    var ongkir = gratisOngkir ? 0 : ongkirAsli;
    return {
      subtotal: subtotal,
      totalQty: totalQty,
      ongkir: ongkir,
      ongkirAsli: ongkirAsli,
      gratisOngkir: gratisOngkir,
      minGratis: minGratis,
      delivery: delivery,
      pengirimanId: opsi.id,
      pengirimanLabel: opsi.label,
      total: subtotal + ongkir
    };
  }

  function linkMaps(lokasi) {
    if (!lokasi || lokasi.lat == null || lokasi.lng == null || lokasi.lat === '' || lokasi.lng === '') return '';
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lokasi.lat + ',' + lokasi.lng);
  }

  function embedMaps(lokasi) {
    if (!lokasi || lokasi.lat == null || lokasi.lng == null || lokasi.lat === '' || lokasi.lng === '') return '';
    return 'https://maps.google.com/maps?q=' + encodeURIComponent(lokasi.lat + ',' + lokasi.lng) + '&z=16&output=embed';
  }

  function buatPesan(items, pembeli, toko, kode) {
    var pb = pembeli || {};
    var t = hitungTotal(items, pb.pengirimanId, toko), mu = (toko && toko.mataUang) || 'Rp';
    var baris = ['Halo *' + toko.nama + '*, saya mau pesan (' + (t.delivery ? 'Delivery' : 'Takeaway') + '):'];
    if (kode) baris.push('*Kode Pesanan: ' + kode + '*');
    baris.push('');
    items.forEach(function (i, n) {
      baris.push((n + 1) + '. *' + i.nama + '*' + (i.label ? ' (' + i.label + ')' : ''));
      baris.push('   ' + i.qty + ' x ' + rupiah(i.harga, mu) + ' = ' + rupiah(i.qty * i.harga, mu));
    });
    baris.push('');
    if (t.delivery) {
      baris.push('Subtotal: ' + rupiah(t.subtotal, mu));
      baris.push('Ongkir (' + t.pengirimanLabel + '): ' + (t.gratisOngkir ? 'GRATIS (Min. ' + t.minGratis + ' item)' : rupiah(t.ongkir, mu)));
      baris.push('*Total Bayar: ' + rupiah(t.total, mu) + '*');
    } else {
      baris.push('*Total: ' + rupiah(t.total, mu) + '*');
    }
    baris.push('');
    baris.push('Nama: ' + (pb.nama || '-'));
    var isCod = t.delivery && String(pb.metodeBayar || '').toLowerCase() === 'cod';
    if (t.delivery) {
      baris.push('Pengiriman: ' + t.pengirimanLabel);
      baris.push('Alamat Lengkap: ' + (pb.alamat || '-'));
      baris.push('Pembayaran: ' + (isCod ? 'COD (Bayar di Tempat)' : 'QRIS DANA (Bukti transfer terlampir)'));
    } else {
      baris.push('Pengambilan: Takeaway (Ambil di lokasi)');
    }
    if (pb.catatan) baris.push('Catatan: ' + pb.catatan);
    baris.push('');
    if (t.delivery && !isCod) {
      baris.push('_Bukti transfer QRIS DANA saya kirimkan bersama pesan ini._');
    } else if (isCod) {
      baris.push('_Struk pemesanan sudah saya simpan. Pembayaran dilakukan di tempat (COD)._');
    } else {
      baris.push('_Struk pemesanan sudah saya simpan untuk bukti pengambilan._');
    }
    baris.push('Terima kasih!');
    return baris.join('\n');
  }

  function linkWA(nomor, pesan) { return 'https://wa.me/' + String(nomor).replace(/\D/g, '') + '?text=' + encodeURIComponent(pesan); }

  function parseCSV(teks) {
    var rows = [], row = [], sel = '', q = false;
    for (var i = 0; i < teks.length; i++) {
      var c = teks[i];
      if (q) { if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++; } else if (c === '"') q = false; else sel += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(sel); sel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && teks[i + 1] === '\n') i++; row.push(sel); rows.push(row); row = []; sel = ''; }
      else sel += c;
    }
    if (sel || row.length) { row.push(sel); rows.push(row); }
    return rows.filter(function (r) { return r.join('').trim(); });
  }

  /** Ubah CSV Google Sheet menjadi array produk. */
  function produkDariCSV(teks) {
    var rows = parseCSV(teks.replace(/^﻿/, '')); if (!rows.length) return [];
    var kepala = rows.shift().map(function (h) { return h.trim(); });
    var warna = ['#7a4b2a', '#3f5b45', '#2f5d7c', '#262626', '#d8c3a0']; // warna ilustrasi produk (bukan warna brand)
    return rows.map(function (r, n) {
      var o = {}; kepala.forEach(function (h, i) { o[h] = (r[i] || '').trim(); });
      return {
        id: o.id || 'p' + n, nama: o.nama, kategori: o.kategori || 'Lainnya', harga: +o.harga || 0, hargaCoret: +o.hargaCoret || 0,
        deskripsi: o.deskripsi || '', label: o.label || '', stok: o.stok === '' ? 99 : +o.stok,
        varian: (o.varian || '').split(';').filter(Boolean).map(function (s) { var a = s.split(':'); return { nama: a[0].trim(), opsi: (a[1] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean) }; }),
        gambar: o.gambar ? o.gambar.split('|') : [{ bentuk: 'tote', warna: warna[n % warna.length], aksen: '#f2e8d5' }]
      };
    }).filter(function (p) { return p.nama; });
  }

  // ================= Ilustrasi SVG buatan sendiri =================
  function ilustrasi(g, sudut) {
    var w = g.warna || '#b4532a', a = g.aksen || '#f2e8d5', s = '';
    var bentuk = {
      kaos: '<path d="M70 62l28-16h24c2 10 12 16 18 16s16-6 18-16h24l28 16 18 40-30 12-10-16v108H92V98l-10 16-30-12z" fill="' + w + '"/><path d="M122 46c2 10 12 16 18 16s16-6 18-16" stroke="' + a + '" stroke-width="5" fill="none"/><rect x="118" y="112" width="44" height="30" rx="4" fill="' + a + '" opacity=".9"/>',
      tote: '<path d="M106 92c0-34 68-34 68 0" stroke="' + a + '" stroke-width="9" fill="none"/><path d="M76 92h128l-8 128H84z" fill="' + w + '"/><circle cx="140" cy="152" r="22" fill="none" stroke="' + a + '" stroke-width="5"/><path d="M128 152h24" stroke="' + a + '" stroke-width="5"/>',
      mug: '<path d="M184 110h14a22 22 0 0 1 0 44h-14" stroke="' + w + '" stroke-width="12" fill="none"/><rect x="88" y="86" width="100" height="120" rx="14" fill="' + w + '"/><ellipse cx="138" cy="90" rx="50" ry="8" fill="' + a + '" opacity=".5"/><path d="M88 150h100" stroke="' + a + '" stroke-width="4" opacity=".6"/>',
      topi: '<path d="M78 160c0-50 26-76 62-76s62 26 62 76z" fill="' + w + '"/><path d="M140 84v76M108 94c8 20 10 44 10 66M172 94c-8 20-10 44-10 66" stroke="' + a + '" stroke-width="3" opacity=".5"/><path d="M66 160h150c14 0 14 18 0 18H90c-18 0-30-8-24-18z" fill="' + w + '" stroke="' + a + '" stroke-width="3"/><circle cx="140" cy="84" r="6" fill="' + a + '"/>',
      botol: '<rect x="118" y="52" width="44" height="26" rx="6" fill="' + a + '"/><path d="M112 80h56l8 18v118a12 12 0 0 1-12 12h-48a12 12 0 0 1-12-12V98z" fill="' + w + '"/><rect x="104" y="128" width="72" height="44" fill="' + a + '" opacity=".85"/>',
      buku: '<rect x="86" y="62" width="112" height="152" rx="6" fill="' + w + '"/><rect x="86" y="62" width="14" height="152" fill="#000" opacity=".15"/><rect x="118" y="96" width="60" height="28" rx="3" fill="' + a + '"/><path d="M190 62v170l-8-8-8 8V62" fill="' + a + '" opacity=".9"/>',
      lilin: '<path d="M140 60c10 14 12 24 0 34-12-10-10-20 0-34z" fill="#f59e0b"/><path d="M140 94v14" stroke="#222" stroke-width="3"/><rect x="92" y="108" width="96" height="110" rx="14" fill="' + w + '"/><rect x="92" y="148" width="96" height="36" fill="' + a + '" opacity=".85"/>',
      tas: '<path d="M96 70l44 70 44-70" stroke="' + a + '" stroke-width="6" fill="none"/><rect x="88" y="120" width="104" height="96" rx="20" fill="' + w + '"/><path d="M88 156h104" stroke="' + a + '" stroke-width="3" opacity=".6"/><rect x="128" y="148" width="24" height="16" rx="3" fill="' + a + '"/>',
      tatakan: '<ellipse cx="140" cy="150" rx="70" ry="70" fill="' + w + '"/><g fill="none" stroke="' + a + '" stroke-width="4" opacity=".7"><circle cx="140" cy="150" r="54"/><circle cx="140" cy="150" r="38"/><circle cx="140" cy="150" r="22"/></g>'
    }[g.bentuk] || '';
    s += '<ellipse cx="140" cy="238" rx="74" ry="9" fill="#000" opacity=".13"/><ellipse cx="140" cy="238" rx="46" ry="5" fill="#000" opacity=".1"/>';
    s += '<g transform="rotate(' + (sudut ? (sudut % 2 ? -8 : 6) : 0) + ' 140 150)">' + bentuk + '</g>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">' + s + '</svg>');
  }
  function srcGambar(g, i) { if (!g) return (window.TOKO && TOKO.fotoKosong) || ''; return typeof g === 'string' ? g : ilustrasi(g, i || 0); }
  if (typeof document !== 'undefined') {
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'IMG') return;
      if (t.id === 'qrisGambar') {
        t.hidden = true;
        var k = document.getElementById('qrisKosong');
        if (k) k.hidden = false;
        return;
      }
      if (!t.dataset.cadangan && window.TOKO && TOKO.fotoKosong && !t.closest('.merek-ikon') && !t.closest('.bukti-preview')) {
        t.dataset.cadangan = '1';
        t.src = TOKO.fotoKosong;
      }
    }, true);
  }

  function pasangLogo() {
    var el = document.querySelector('.merek-ikon'); if (!el) return;
    var inisial = function () { el.classList.remove('ada-logo'); el.textContent = ((window.TOKO && TOKO.nama) || 'T').trim().charAt(0).toUpperCase(); };
    if (!window.TOKO || !TOKO.logo) return inisial();
    var img = new Image(); img.alt = ''; img.onerror = inisial; img.src = TOKO.logo;
    el.textContent = ''; el.appendChild(img); el.classList.add('ada-logo');
  }
  var API = { rupiah: rupiah, hargaVarian: hargaVarian, daftarPengiriman: daftarPengiriman, cariPengiriman: cariPengiriman, hitungTotal: hitungTotal, linkMaps: linkMaps, embedMaps: embedMaps, buatPesan: buatPesan, linkWA: linkWA, parseCSV: parseCSV, produkDariCSV: produkDariCSV, ilustrasi: ilustrasi };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.__katalog = API;

  // ================= Aplikasi browser =================
  var TOKO = root.TOKO, PRODUK = root.PRODUK || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rp(n) { return rupiah(n, TOKO.mataUang); }
  var simpanan = { get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  var tt; function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('tampil'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('tampil'); }, 3000); }

  var keranjang = simpanan.get('katalog-keranjang', []);
  var katAktif = 'Semua';
  var alamatDeliverySimpan = '';
  var buktiFileAktif = null;
  var buktiDataUrlAktif = '';
  var detailAktifRender = null;
  var sedangSinkronStok = false;
  var INTERVAL_STOK_MS = 15000;

  function cari(id) { return PRODUK.find(function (p) { return p.id === id; }); }

  function inisialisasiStokAwal() {
    PRODUK.forEach(function (p) {
      if (p.stokAwal == null) p.stokAwal = Number(p.stok) || 0;
    });
  }

  function qtyDiKeranjang(produkId) {
    return keranjang.reduce(function (s, i) {
      return i.id === produkId ? s + (Number(i.qty) || 0) : s;
    }, 0);
  }

  function validasiKeranjangTerhadapStok(diam) {
    var berubah = false;
    var pesan = [];
    var terpakai = {};
    var baru = [];

    keranjang.forEach(function (item) {
      var p = cari(item.id);
      if (!p) {
        baru.push(item);
        return;
      }
      var stokTersedia = Math.max(0, Number(p.stok) || 0);
      var sudah = terpakai[p.id] || 0;
      var sisaBoleh = Math.max(0, stokTersedia - sudah);

      if (sisaBoleh <= 0) {
        berubah = true;
        pesan.push('Stok ' + p.nama + ' sudah habis dan dihapus dari keranjang.');
        return;
      }
      if (item.qty > sisaBoleh) {
        berubah = true;
        item.qty = sisaBoleh;
        pesan.push('Jumlah ' + p.nama + ' disesuaikan dengan sisa stok (' + stokTersedia + ').');
      }
      terpakai[p.id] = sudah + item.qty;
      baru.push(item);
    });

    if (berubah) {
      keranjang = baru;
      simpanan.set('katalog-keranjang', keranjang);
      if (!diam && pesan.length) toast(pesan[0]);
    }
    return { berubah: berubah, pesan: pesan };
  }

  function renderSorotan() {
    var unggul = PRODUK.filter(function (p) { return p.label && p.stok > 0; })[0]
      || PRODUK.filter(function (p) { return p.stok > 0; })[0]
      || PRODUK[0];
    if (!unggul) return;
    var habis = unggul.stok <= 0;
    $('#sorotan').innerHTML = '<button class="sorotan-kartu' + (habis ? ' habis' : '') + '" data-id="' + esc(unggul.id) + '"><span class="sorotan-gambar"><img src="' + srcGambar(unggul.gambar[0]) + '" alt="' + esc(unggul.nama) + '"></span>' +
      '<span class="sorotan-info"><small>' + esc(habis ? 'Stok habis' : (unggul.label || 'Pilihan minggu ini')) + '</small><b>' + esc(unggul.nama) + '</b><span class="harga">' + rp(unggul.harga) + (unggul.hargaCoret ? ' <s>' + rp(unggul.hargaCoret) + '</s>' : '') + '</span></span>' +
      '<span class="sorotan-panah" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg></span></button>';
    $('#sorotan').onclick = function () { bukaDetail(unggul); };
  }

  function perbaruiJumlahProdukTersedia() {
    var tersedia = PRODUK.filter(function (p) { return (Number(p.stok) || 0) > 0; }).length;
    $('#jumlahProduk').textContent = tersedia;
  }

  function sinkronkanStok(diam) {
    if (!root.StrukKit || !root.StrukKit.ambilSemuaPesanan || !root.StrukKit.terapkanStokRealTime) {
      return Promise.resolve({ ok: false });
    }
    if (sedangSinkronStok) return Promise.resolve({ ok: false, sibuk: true });
    sedangSinkronStok = true;
    return root.StrukKit.ambilSemuaPesanan(TOKO).then(function (res) {
      sedangSinkronStok = false;
      var daftar = (res && Array.isArray(res.data)) ? res.data : [];
      root.StrukKit.terapkanStokRealTime(PRODUK, daftar);
      var hasilCek = validasiKeranjangTerhadapStok(diam);
      perbaruiJumlahProdukTersedia();
      renderSorotan();
      renderGrid();
      renderKeranjang();
      if (typeof detailAktifRender === 'function' && $('#detail') && $('#detail').open) {
        detailAktifRender();
      }
      return { ok: true, res: res, validasi: hasilCek };
    }).catch(function () {
      sedangSinkronStok = false;
      return { ok: false };
    });
  }

  var metodeBayarPilihan = 'qris';

  function pastikanUIMetodeBayar() {
    var blokQris = $('#blokQris');
    if (!blokQris || !blokQris.parentNode) return;
    if (!$('#labelMetodeBayar')) {
      var wrap = document.createElement('div');
      wrap.className = 'blok-metode-bayar';
      wrap.id = 'labelMetodeBayar';
      wrap.hidden = true;
      wrap.innerHTML =
        '<span class="metode-judul">Metode Pembayaran (Delivery)</span>' +
        '<div class="metode-opsi" role="radiogroup" aria-label="Metode Pembayaran">' +
          '<button type="button" class="metode-btn aktif" data-metode="qris" aria-pressed="true">Transfer QRIS</button>' +
          '<button type="button" class="metode-btn" data-metode="cod" aria-pressed="false">COD (Bayar di Tempat)</button>' +
        '</div>' +
        '<select name="metodeBayar" id="pilihMetodeBayar" aria-label="Metode Pembayaran" hidden>' +
          '<option value="qris">Transfer QRIS DANA (Upload Bukti)</option>' +
          '<option value="cod">COD (Bayar di Tempat)</option>' +
        '</select>';
      blokQris.parentNode.insertBefore(wrap, blokQris);
    }
    if (!$('#blokCod')) {
      var cod = document.createElement('div');
      cod.className = 'blok-cod';
      cod.id = 'blokCod';
      cod.hidden = true;
      cod.innerHTML =
        '<div class="qris-kepala"><span class="qris-lencana">COD · Bayar di Tempat</span><strong id="codNominal">Rp0</strong></div>' +
        '<p class="qris-info">Pembayaran dilakukan secara tunai saat pesanan diantar ke alamat tujuan. Tidak perlu mengunggah bukti transfer.</p>';
      blokQris.parentNode.insertBefore(cod, blokQris);
    }
    var kontainer = $('#labelMetodeBayar');
    if (kontainer && !kontainer.dataset.terikat) {
      kontainer.dataset.terikat = '1';
      kontainer.addEventListener('click', function (e) {
        var btn = e.target.closest('.metode-btn');
        if (!btn) return;
        setMetodeBayar(btn.dataset.metode);
      });
    }
    var sel = $('#pilihMetodeBayar');
    if (sel && !sel.dataset.terikat) {
      sel.dataset.terikat = '1';
      sel.onchange = function () { setMetodeBayar(this.value); };
    }
  }

  function setMetodeBayar(val) {
    metodeBayarPilihan = val === 'cod' ? 'cod' : 'qris';
    var sel = $('#pilihMetodeBayar');
    if (sel) sel.value = metodeBayarPilihan;
    $$('#labelMetodeBayar .metode-btn').forEach(function (b) {
      var aktif = b.dataset.metode === metodeBayarPilihan;
      b.classList.toggle('aktif', aktif);
      b.setAttribute('aria-pressed', String(aktif));
    });
    perbaruiModePengiriman();
  }

  function pengirimanAktifId() {
    var sel = $('#pilihPengiriman');
    return (sel && sel.value) || 'takeaway';
  }

  function metodeBayarAktif() {
    var sel = $('#pilihMetodeBayar');
    if (sel && (sel.value === 'cod' || sel.value === 'qris')) return sel.value;
    return metodeBayarPilihan === 'cod' ? 'cod' : 'qris';
  }

  function renderOpsiPengiriman() {
    var sel = $('#pilihPengiriman');
    if (!sel) return;
    var opsi = daftarPengiriman(TOKO);
    sel.innerHTML = opsi.map(function (o) {
      var biaya = o.delivery ? ' (' + rp(o.ongkir) + ')' : ' (Gratis)';
      return '<option value="' + esc(o.id) + '">' + esc(o.label + biaya) + '</option>';
    }).join('');
  }

  function perbaruiModePengiriman() {
    pastikanUIMetodeBayar();
    var id = pengirimanAktifId();
    var opsi = cariPengiriman(id, TOKO);
    var delivery = !!opsi.delivery;
    var metode = metodeBayarAktif();
    var isQris = delivery && metode === 'qris';
    var isCod = delivery && metode === 'cod';
    var inputAlamat = $('#inputAlamat');
    var judulAlamat = $('#judulAlamat');
    var labelMetode = $('#labelMetodeBayar');
    var blokQris = $('#blokQris');
    var blokCod = $('#blokCod');
    var inputBukti = $('#inputBukti');
    var infoStruk = $('#infoStruk');
    var alamatStan = (TOKO.lokasi && TOKO.lokasi.alamat) || '';

    if (inputAlamat) {
      if (delivery) {
        if (inputAlamat.readOnly) {
          inputAlamat.value = alamatDeliverySimpan || '';
        }
        inputAlamat.readOnly = false;
        inputAlamat.required = true;
        inputAlamat.classList.remove('alamat-terkunci');
        if (judulAlamat) judulAlamat.textContent = 'Alamat Lengkap Pengiriman (Wajib)';
      } else {
        // Simpan dulu jika sebelumnya sedang mengisi alamat delivery
        if (!inputAlamat.readOnly && inputAlamat.value.trim()) {
          alamatDeliverySimpan = inputAlamat.value.trim();
        }
        inputAlamat.readOnly = true;
        inputAlamat.required = false;
        inputAlamat.classList.add('alamat-terkunci');
        inputAlamat.value = alamatStan;
        if (judulAlamat) judulAlamat.textContent = 'Alamat Stan (Terkunci — Takeaway)';
      }
    }

    if (labelMetode) labelMetode.hidden = !delivery;
    if (blokQris) blokQris.hidden = !isQris;
    if (blokCod) blokCod.hidden = !isCod;
    if (inputBukti) inputBukti.required = isQris;
    if (infoStruk) {
      infoStruk.textContent = isQris
        ? 'Pembayaran QRIS DANA. Unggah bukti transfer untuk dikirim otomatis ke WhatsApp.'
        : isCod
          ? 'Pembayaran COD (Bayar di Tempat). Mohon simpan struk untuk bukti pemesanan saat kurir tiba.'
          : 'Mohon simpan struk untuk bukti pemesanan dan pengambilan.';
    }

    var qrisImg = $('#qrisGambar');
    var qrisUnduh = $('#btnUnduhQris');
    var srcQris = (TOKO.pembayaran && TOKO.pembayaran.qrisGambar) || 'img/qris.jpg';
    if (qrisImg && qrisImg.getAttribute('src') !== srcQris) {
      qrisImg.hidden = false;
      var qk = $('#qrisKosong'); if (qk) qk.hidden = true;
      qrisImg.src = srcQris;
    }
    if (qrisUnduh) qrisUnduh.href = srcQris;

    renderRingkasan();
  }

  function resetBukti() {
    buktiFileAktif = null;
    buktiDataUrlAktif = '';
    var inp = $('#inputBukti'); if (inp) inp.value = '';
    var prev = $('#buktiPreview'); if (prev) prev.hidden = true;
    var img = $('#buktiPreviewImg'); if (img) img.removeAttribute('src');
  }

  function resetFormPembeli() {
    alamatDeliverySimpan = '';
    var f = $('#formPesan');
    if (f) {
      if (f.elements.nama) f.elements.nama.value = '';
      if (f.elements.catatan) f.elements.catatan.value = '';
    }
    var selPengiriman = $('#pilihPengiriman');
    var opsi = daftarPengiriman(TOKO);
    if (selPengiriman && opsi.length) {
      selPengiriman.value = opsi[0].id;
    }
    var inpAlamat = $('#inputAlamat');
    if (inpAlamat) {
      inpAlamat.value = '';
      inpAlamat.readOnly = false;
    }
    resetBukti();
    setMetodeBayar('qris');
    try { localStorage.removeItem('katalog-pembeli'); } catch (e) {}
  }

  function renderKategori() {
    var kats = ['Semua'];
    PRODUK.forEach(function (p) { if (kats.indexOf(p.kategori) < 0) kats.push(p.kategori); });
    $('#kategori').innerHTML = kats.map(function (k) { return '<button class="kat' + (k === katAktif ? ' aktif' : '') + '" data-k="' + esc(k) + '">' + esc(k) + '</button>'; }).join('');
  }

  function renderGrid() {
    var q = $('#cari').value.trim().toLowerCase(), u = $('#urut').value;
    var list = PRODUK.filter(function (p) { return (katAktif === 'Semua' || p.kategori === katAktif) && (p.nama + ' ' + p.deskripsi + ' ' + p.kategori).toLowerCase().indexOf(q) > -1; });
    if (u === 'murah') list.sort(function (a, b) { return a.harga - b.harga; });
    if (u === 'mahal') list.sort(function (a, b) { return b.harga - a.harga; });
    if (u === 'nama') list.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
    $('#jumlahHasil').textContent = list.length + ' produk';
    $('#grid').innerHTML = list.length ? list.map(function (p, n) {
      var stok = Math.max(0, Number(p.stok) || 0);
      var habis = stok === 0, warna = (p.varian || []).filter(function (v) { return v.nama === 'Warna'; })[0];
      var infoStokKartu = habis ? ' · Habis' : (' · Sisa ' + stok);
      return '<button class="kartu' + (habis ? ' habis' : '') + '" data-id="' + esc(p.id) + '" style="--i:' + Math.min(n, 12) + '"><div class="kartu-gambar"><img src="' + srcGambar(p.gambar[0]) + '" alt="' + esc(p.nama) + '" loading="lazy">' +
        (habis ? '<span class="label habis">Stok habis</span>' : p.label ? '<span class="label">' + esc(p.label) + '</span>' : '') +
        (habis ? '' : '<span class="kartu-plus" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>') + '</div>' +
        '<span class="kartu-info"><span class="kat-kecil">' + esc(p.kategori) + (warna ? ' · ' + warna.opsi.length + ' warna' : '') + esc(infoStokKartu) + '</span><h3>' + esc(p.nama) + '</h3><span class="harga">' + rp(p.harga) + (p.hargaCoret ? ' <s>' + rp(p.hargaCoret) + '</s>' : '') + '</span></span></button>';
    }).join('') : '<div class="kosong"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><b>Produk tidak ditemukan</b><span>Coba kata lain atau pilih "Semua".</span></div>';
  }

  function renderLokasi() {
    var sec = $('#lokasi'), btnNav = $('#btnLokasi');
    var lok = TOKO.lokasi, url = linkMaps(lok);
    if (!sec || !url) {
      if (sec) sec.hidden = true;
      if (btnNav) btnNav.hidden = true;
      return;
    }
    var nama = lok.nama || TOKO.nama;
    var koord = lok.lat + ', ' + lok.lng;
    sec.hidden = false;
    if (btnNav) btnNav.hidden = false;
    sec.innerHTML =
      '<div class="judul-daftar"><h2>Lokasi Stan</h2><span class="redup">Pengambilan Takeaway</span></div>' +
      '<div class="lokasi-kartu">' +
        '<div class="lokasi-peta"><iframe src="' + esc(embedMaps(lok)) + '" title="Peta lokasi ' + esc(nama) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>' +
        '<div class="lokasi-info">' +
          '<span class="lokasi-tag"><i></i>Ambil di lokasi</span>' +
          '<h3>' + esc(nama) + '</h3>' +
          (lok.alamat ? '<p class="lokasi-alamat">' + esc(lok.alamat) + '</p>' : '') +
          (lok.jamBuka ? '<p class="lokasi-jam"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>' + esc(lok.jamBuka) + '</span></p>' : '') +
          '<p class="lokasi-koordinat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg><span>' + esc(koord) + '</span></p>' +
          '<div class="lokasi-aksi"><a class="tombol lokasi-btn" href="' + esc(url) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>Buka di Google Maps</a></div>' +
        '</div>' +
      '</div>';
  }

  // ---------- detail ----------
  function bukaDetail(p) {
    var pilihan = {}, qty = 1, aktifGbr = 0;
    (p.varian || []).forEach(function (v) { pilihan[v.nama] = v.opsi[0]; });
    function render() {
      var stok = Math.max(0, Number(p.stok) || 0);
      var diKeranjang = qtyDiKeranjang(p.id);
      var maksTambah = Math.max(0, stok - diKeranjang);
      var habis = stok === 0;
      var penuhDiKeranjang = !habis && maksTambah === 0;
      if (maksTambah > 0 && qty > maksTambah) qty = maksTambah;
      if (qty < 1) qty = 1;

      var teksStok = habis
        ? 'Stok sedang habis, tidak dapat melakukan pemesanan.'
        : penuhDiKeranjang
          ? 'Sisa stok ' + stok + ' (semua sudah ada di keranjangmu).'
          : stok <= 10
            ? 'Sisa ' + stok + ', jangan sampai kehabisan.'
            : 'Stok tersedia (' + stok + '), siap dipesan';

      var labelTombol = habis
        ? 'Stok habis'
        : penuhDiKeranjang
          ? 'Batas stok di keranjang'
          : 'Tambah · ' + rp(hargaVarian(p, pilihan) * qty);

      $('#detailIsi').innerHTML = '<button class="ikon-btn tutup-modal" id="tutupDetail" aria-label="Tutup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="detail">' +
        '<div class="galeri"><div class="galeri-utama"><img src="' + srcGambar(p.gambar[aktifGbr], aktifGbr) + '" alt="' + esc(p.nama) + '"></div>' +
        (p.gambar.length > 1 ? '<div class="galeri-kecil">' + p.gambar.map(function (g, i) { return '<button data-g="' + i + '" class="' + (i === aktifGbr ? 'aktif' : '') + '" aria-label="Gambar ' + (i + 1) + '"><img src="' + srcGambar(g, i) + '" alt=""></button>'; }).join('') + '</div>' : '') + '</div>' +
        '<div class="info"><span class="kat-kecil redup">' + esc(p.kategori) + '</span><h2>' + esc(p.nama) + '</h2>' +
        '<span class="harga">' + rp(hargaVarian(p, pilihan)) + (p.hargaCoret ? ' <s>' + rp(p.hargaCoret) + '</s>' : '') + '</span><p>' + esc(p.deskripsi) + '</p>' +
        (p.varian || []).map(function (v) {
          return '<div class="varian"><b>' + esc(v.nama) + '</b><div class="opsi">' + v.opsi.map(function (o) { return '<button data-v="' + esc(v.nama) + '" data-o="' + esc(o) + '" class="' + (pilihan[v.nama] === o ? 'aktif' : '') + '">' + esc(o) + (v.tambah && v.tambah[o] ? ' <small>+' + (v.tambah[o] / 1000) + 'rb</small>' : '') + '</button>'; }).join('') + '</div></div>';
        }).join('') +
        '<span class="stok-info' + (habis ? ' habis' : stok <= 10 ? ' tipis' : '') + '"><i></i>' + esc(teksStok) + '</span>' +
        '<div class="beli"><div class="jumlah"><button data-q="-1" aria-label="Kurangi"' + (habis || penuhDiKeranjang ? ' disabled' : '') + '>−</button><span>' + (habis || penuhDiKeranjang ? 0 : qty) + '</span><button data-q="1" aria-label="Tambah"' + (habis || penuhDiKeranjang || qty >= maksTambah ? ' disabled' : '') + '>+</button></div>' +
        '<button class="tombol" id="btnTambah"' + (habis || penuhDiKeranjang ? ' disabled' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.5 12h-11zM9 8a3 3 0 0 1 6 0"/></svg>' + labelTombol + '</button></div></div></div>';
    }
    detailAktifRender = render;
    render();
    var d = $('#detail'); if (!d.open) d.showModal();
    $('#detailIsi').onclick = function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.id === 'tutupDetail') { detailAktifRender = null; return d.close(); }
      if (t.dataset.g) { aktifGbr = +t.dataset.g; render(); }
      else if (t.dataset.v) {
        pilihan[t.dataset.v] = t.dataset.o;
        var idx = -1; (p.varian || []).forEach(function (v) { if (v.nama === 'Warna') idx = v.opsi.indexOf(pilihan.Warna); });
        if (t.dataset.v === 'Warna' && idx > -1 && p.gambar[idx]) aktifGbr = idx;
        render();
      }
      else if (t.dataset.q) {
        var maks = Math.max(0, (Number(p.stok) || 0) - qtyDiKeranjang(p.id));
        if (maks <= 0) return;
        qty = Math.max(1, Math.min(maks, qty + +t.dataset.q));
        render();
      }
      else if (t.id === 'btnTambah') {
        if (tambah(p, pilihan, qty)) {
          detailAktifRender = null;
          d.close();
        }
      }
    };
  }
  $('#detail').addEventListener('click', function (e) { if (e.target === this) { detailAktifRender = null; this.close(); } });
  $('#detail').addEventListener('close', function () { detailAktifRender = null; });

  // ---------- struk digital ----------
  function perbaruiTombolStrukTerakhir() {
    var btn = $('#btnStrukTerakhir');
    if (!btn || !root.StrukKit) return;
    var riwayat = root.StrukKit.bacaLokal();
    btn.hidden = !riwayat.length;
  }

  function bukaStruk(pesanan, infoSimpan, fileBukti) {
    if (!root.StrukKit) return;
    var modal = $('#strukModal'), isi = $('#strukModalIsi');
    if (!modal || !isi) return;
    var waUrl = linkWA(TOKO.wa, pesanan.pesan_wa || buatPesan(pesanan.items, pesanan, TOKO, pesanan.kode));
    var isQris = pesanan.metode_bayar === 'QRIS DANA' || !!pesanan.bukti_bayar;
    var statusSimpan = infoSimpan && infoSimpan.mode === 'supabase'
      ? '<span class="struk-status ok">Tercatat otomatis di sistem admin</span>'
      : '<span class="struk-status">Struk siap disimpan &amp; dikirim ke WhatsApp</span>';

    var blokBuktiModal = isQris && pesanan.bukti_bayar
      ? '<div class="struk-bukti-box"><small>Bukti Transfer QRIS DANA terlampir</small><img src="' + esc(pesanan.bukti_bayar) + '" alt="Bukti transfer"></div>'
      : '';

    var tombolAksi = isQris
      ? '<button type="button" class="tombol-wa" id="aksiKirimBuktiWA"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9.5 9.5c0 2.5 2.5 5 5 5l1-1.5-2-1-1 .8a3.5 3.5 0 0 1-1.8-1.8l.8-1-1-2z"/></svg>Kirim Pesan &amp; Bukti Transfer ke WA</button>' +
        '<div class="struk-aksi-baris">' +
          '<a class="tombol-sekunder" id="aksiKirimWA" href="' + esc(waUrl) + '" target="_blank" rel="noopener">Chat WA (Teks)</a>' +
          '<button type="button" class="tombol-sekunder" id="aksiCetakPDF"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></svg>Cetak / PDF</button>' +
          '<button type="button" class="tombol-sekunder" id="aksiUnduhPNG"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>Struk (PNG)</button>' +
        '</div>'
      : '<a class="tombol-wa" id="aksiKirimWA" href="' + esc(waUrl) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9.5 9.5c0 2.5 2.5 5 5 5l1-1.5-2-1-1 .8a3.5 3.5 0 0 1-1.8-1.8l.8-1-1-2z"/></svg>Kirim Pesan ke WhatsApp</a>' +
        '<div class="struk-aksi-baris">' +
          '<button type="button" class="tombol-sekunder" id="aksiBagikanWA"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Bagikan Gambar ke WA</button>' +
          '<button type="button" class="tombol-sekunder" id="aksiCetakPDF"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></svg>Cetak / Download PDF</button>' +
          '<button type="button" class="tombol-sekunder" id="aksiUnduhPNG"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>Download Gambar (PNG)</button>' +
        '</div>';

    isi.innerHTML =
      '<div class="struk-modal-bungkus">' +
        '<header class="struk-modal-kepala">' +
          '<div><h2>Struk Pemesanan</h2>' + statusSimpan + '</div>' +
          '<button class="ikon-btn" id="tutupStruk" aria-label="Tutup struk"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</header>' +
        '<div class="struk-modal-badan">' + root.StrukKit.renderStrukHTML(pesanan, TOKO) + blokBuktiModal + '</div>' +
        '<div class="struk-aksi">' + tombolAksi + '</div>' +
      '</div>';

    if (!modal.open) modal.showModal();
    isi.onclick = function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'tutupStruk') return modal.close();
      if (btn.id === 'aksiCetakPDF') {
        root.StrukKit.cetakStrukPDF(pesanan, TOKO);
      } else if (btn.id === 'aksiUnduhPNG') {
        root.StrukKit.unduhStrukPNG(pesanan, TOKO)
          .then(function () { toast('Gambar struk tersimpan'); })
          .catch(function () { toast('Gagal mengunduh gambar struk'); });
      } else if (btn.id === 'aksiBagikanWA') {
        root.StrukKit.bagikanStrukKeWA(pesanan, TOKO, waUrl).then(function (res) {
          if (res && res.metode === 'fallback') {
            toast('Gambar struk diunduh — silakan lampirkan di chat WhatsApp');
          }
        }).catch(function () {
          toast('Gagal membagikan gambar, gunakan tombol Download PNG');
        });
      } else if (btn.id === 'aksiKirimBuktiWA') {
        root.StrukKit.bagikanBuktiKeWA(pesanan, fileBukti, waUrl).then(function (res) {
          if (res && res.metode === 'fallback') {
            toast('Chat WA dibuka & bukti transfer diunduh — silakan lampirkan di chat');
          }
        }).catch(function () {
          window.open(waUrl, '_blank', 'noopener');
        });
      }
    };
  }
  var strukModalEl = $('#strukModal');
  if (strukModalEl) strukModalEl.addEventListener('click', function (e) { if (e.target === this) this.close(); });

  // ---------- keranjang ----------
  function labelPilihan(pil) { return Object.keys(pil || {}).map(function (k) { return pil[k]; }).join(', '); }
  function tambah(p, pilihan, qty) {
    var stok = Math.max(0, Number(p.stok) || 0);
    if (stok <= 0) {
      toast('Maaf, stok ' + p.nama + ' sudah habis');
      return false;
    }
    var sudah = qtyDiKeranjang(p.id);
    if (sudah + qty > stok) {
      toast('Stok ' + p.nama + ' tersisa ' + stok + (sudah ? ' (' + sudah + ' sudah di keranjang)' : ''));
      return false;
    }
    var kunci = p.id + '|' + JSON.stringify(pilihan);
    var ada = keranjang.find(function (i) { return i.kunci === kunci; });
    if (ada) ada.qty += qty;
    else keranjang.push({ kunci: kunci, id: p.id, nama: p.nama, label: labelPilihan(pilihan), harga: hargaVarian(p, pilihan), qty: qty, gIdx: 0 });
    simpan(); toast(p.nama + ' masuk keranjang');
    var h = $('#hitungKeranjang'); h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop');
    return true;
  }
  function simpan() { simpanan.set('katalog-keranjang', keranjang); renderKeranjang(); }

  function renderRingkasan() {
    var t = hitungTotal(keranjang, pengirimanAktifId(), TOKO);
    var urlMaps = linkMaps(TOKO.lokasi);
    var html = '';
    if (t.delivery) {
      html += '<div><span>Subtotal (' + t.totalQty + ' item)</span><span>' + rp(t.subtotal) + '</span></div>';
      html += '<div><span>Ongkir</span><span>' + (t.gratisOngkir ? '<s>' + rp(t.ongkirAsli) + '</s> <b class="gratis-tag">GRATIS</b>' : rp(t.ongkir)) + '</span></div>';
    }
    html += '<div class="total"><span>Total</span><span>' + rp(t.total) + '</span></div>';
    if (t.delivery) {
      if (t.gratisOngkir) {
        html += '<div class="catatan">Gratis ongkir aktif! (Min. ' + t.minGratis + ' item terpenuhi)</div>';
      } else {
        var kurang = Math.max(0, t.minGratis - t.totalQty);
        html += '<div class="catatan">Tambah ' + kurang + ' item lagi (bebas/mix) untuk Gratis Ongkir</div>';
      }
    } else {
      html += '<div class="catatan">Takeaway · Ambil di stan' + (urlMaps ? ' · <a href="' + esc(urlMaps) + '" target="_blank" rel="noopener">Lihat Maps</a>' : '') + '</div>';
    }
    $('#ringkas').innerHTML = html;
    var qn = $('#qrisNominal');
    if (qn) qn.textContent = rp(t.total);
    var cn = $('#codNominal');
    if (cn) cn.textContent = rp(t.total);
    $('#btnWa').disabled = !keranjang.length;
  }

  function renderKeranjang() {
    var n = keranjang.reduce(function (s, i) { return s + i.qty; }, 0);
    $('#hitungKeranjang').hidden = !n; $('#hitungKeranjang').textContent = n;
    $('#laciJumlah').textContent = n ? n + ' barang' : '';
    $('#laciIsi').innerHTML = keranjang.length ? keranjang.map(function (i, k) {
      var p = cari(i.id), g = p ? p.gambar[0] : { bentuk: 'tote' };
      var stokInfo = p ? (' · Sisa ' + Math.max(0, Number(p.stok) || 0)) : '';
      return '<div class="item" style="--i:' + k + '"><span class="item-gambar"><img src="' + srcGambar(g) + '" alt=""></span><div><b>' + esc(i.nama) + '</b><small>' + esc(i.label || '') + (i.label ? ' · ' : '') + rp(i.harga) + esc(stokInfo) + '</small><br><button class="hapus" data-hapus="' + k + '">Hapus</button></div>' +
        '<div class="jumlah"><button data-k="' + k + '" data-d="-1" aria-label="Kurangi">−</button><span>' + i.qty + '</span><button data-k="' + k + '" data-d="1" aria-label="Tambah">+</button></div></div>';
    }).join('') : '<div class="laci-kosong"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.5 12h-11zM9 8a3 3 0 0 1 6 0"/></svg><b>Keranjang masih kosong</b><span>Yuk pilih barang dulu.</span></div>';
    renderRingkasan();
    perbaruiTombolStrukTerakhir();
  }

  function bukaLaci(buka) {
    $('#laci').classList.toggle('buka', buka); $('#laci').setAttribute('aria-hidden', String(!buka)); $('#tirai').hidden = !buka;
  }

  // ---------- mulai ----------
  function mulai() {
    inisialisasiStokAwal();
    document.title = TOKO.nama + ' — Katalog';
    $('#namaToko').textContent = TOKO.nama; $('#namaTokoKaki').textContent = TOKO.nama; $('#slogan').textContent = TOKO.slogan; pasangLogo();
    $('#tahun').textContent = new Date().getFullYear();
    var minGratisEl = $('#minGratisTeks');
    if (minGratisEl && TOKO.pengiriman && TOKO.pengiriman.minGratisOngkir) {
      minGratisEl.textContent = TOKO.pengiriman.minGratisOngkir;
    }
    renderOpsiPengiriman();
    pastikanUIMetodeBayar();
    resetFormPembeli();

    perbaruiJumlahProdukTersedia();
    renderSorotan();
    renderKategori(); renderGrid(); renderLokasi(); renderKeranjang();
    sinkronkanStok(true);

    setInterval(function () {
      if (!document.hidden) sinkronkanStok(true);
    }, INTERVAL_STOK_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) sinkronkanStok(true);
    });
    window.addEventListener('focus', function () {
      sinkronkanStok(true);
    });

    if (/[?&]keranjang\b/.test(location.search)) { if (!keranjang.length && PRODUK[0] && PRODUK[0].stok > 0) { tambah(PRODUK[0], {}, 2); } bukaLaci(true); }
  }

  $('#kategori').onclick = function (e) { var b = e.target.closest('.kat'); if (b) { katAktif = b.dataset.k; renderKategori(); renderGrid(); } };
  $('#cari').oninput = renderGrid; $('#urut').onchange = renderGrid;
  $('#grid').onclick = function (e) { var k = e.target.closest('.kartu'); if (k) bukaDetail(cari(k.dataset.id)); };
  $('#btnKeranjang').onclick = function () { bukaLaci(true); sinkronkanStok(false); };
  $('#tutupLaci').onclick = $('#tirai').onclick = function () { bukaLaci(false); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') bukaLaci(false); });
  $('#laciIsi').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.hapus) keranjang.splice(+b.dataset.hapus, 1);
    else if (b.dataset.k) {
      var i = keranjang[+b.dataset.k];
      var delta = +b.dataset.d;
      if (delta > 0) {
        var p = cari(i.id);
        var stok = p ? Math.max(0, Number(p.stok) || 0) : 99;
        if (qtyDiKeranjang(i.id) + delta > stok) {
          toast('Stok ' + i.nama + ' tersisa ' + stok);
          return;
        }
      }
      i.qty += delta;
      if (i.qty < 1) keranjang.splice(+b.dataset.k, 1);
    }
    simpan();
  };

  if ($('#pilihPengiriman')) {
    $('#pilihPengiriman').onchange = function () {
      perbaruiModePengiriman();
    };
  }
  if ($('#inputAlamat')) {
    $('#inputAlamat').oninput = function () {
      if (!this.readOnly) alamatDeliverySimpan = this.value;
    };
  }
  if ($('#inputBukti')) {
    $('#inputBukti').onchange = function () {
      var file = this.files && this.files[0];
      if (!file) { resetBukti(); return; }
      buktiFileAktif = file;
      var kompres = root.StrukKit && root.StrukKit.kompresGambar
        ? root.StrukKit.kompresGambar(file, 720, 0.72)
        : Promise.resolve('');
      kompres.then(function (dataUrl) {
        buktiDataUrlAktif = dataUrl || '';
        if (dataUrl && $('#buktiPreviewImg') && $('#buktiPreview')) {
          $('#buktiPreviewImg').src = dataUrl;
          $('#buktiPreview').hidden = false;
        }
      }).catch(function () {
        toast('Gagal memproses gambar bukti transfer');
      });
    };
  }
  if ($('#btnHapusBukti')) {
    $('#btnHapusBukti').onclick = resetBukti;
  }

  var btnStrukTerakhir = $('#btnStrukTerakhir');
  if (btnStrukTerakhir) {
    btnStrukTerakhir.onclick = function () {
      if (!root.StrukKit) return;
      var riwayat = root.StrukKit.bacaLokal();
      if (riwayat.length) { bukaLaci(false); bukaStruk(riwayat[0]); }
    };
  }
  $('#formPesan').addEventListener('invalid', function () { $('#dataPembeli').open = true; }, true);
  $('#formPesan').onsubmit = function (e) {
    e.preventDefault(); var f = e.target;
    if (!keranjang.length) return;
    var pgId = pengirimanAktifId();
    var metode = metodeBayarAktif();
    var t = hitungTotal(keranjang, pgId, TOKO);
    var isQris = t.delivery && metode === 'qris';
    var isCod = t.delivery && metode === 'cod';
    var alamatInput = (f.elements.alamat && f.elements.alamat.value.trim()) || '';

    if (t.delivery && !alamatInput) {
      $('#dataPembeli').open = true;
      toast('Mohon isi alamat lengkap pengiriman terlebih dahulu');
      if (f.elements.alamat) f.elements.alamat.focus();
      return;
    }
    if (isQris && !buktiFileAktif && !buktiDataUrlAktif) {
      $('#dataPembeli').open = true;
      toast('Mohon unggah bukti transfer QRIS DANA terlebih dahulu');
      if ($('#inputBukti')) $('#inputBukti').focus();
      return;
    }

    var btn = $('#btnWa');
    var labelAsli = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Memeriksa stok…';

    var cekStokTerbaru = (root.StrukKit && root.StrukKit.ambilSemuaPesanan && root.StrukKit.terapkanStokRealTime)
      ? root.StrukKit.ambilSemuaPesanan(TOKO).then(function (res) {
          var daftar = (res && Array.isArray(res.data)) ? res.data : [];
          root.StrukKit.terapkanStokRealTime(PRODUK, daftar);
          perbaruiJumlahProdukTersedia();
          renderSorotan();
          renderGrid();
        }).catch(function () {})
      : Promise.resolve();

    cekStokTerbaru.then(function () {
      var hasilValidasi = validasiKeranjangTerhadapStok(true);
      if (hasilValidasi.berubah || !keranjang.length) {
        renderKeranjang();
        btn.innerHTML = labelAsli;
        btn.disabled = !keranjang.length;
        toast(hasilValidasi.pesan[0] || 'Stok produk tidak mencukupi. Silakan periksa keranjang.');
        return;
      }

      // Hitung ulang total setelah memastikan stok aman
      t = hitungTotal(keranjang, pgId, TOKO);
      if (t.delivery) alamatDeliverySimpan = alamatInput;
      var pb = {
        nama: f.elements.nama.value.trim(),
        catatan: f.elements.catatan.value.trim(),
        pengirimanId: pgId,
        metodeBayar: metode,
        alamat: t.delivery ? alamatInput : ((TOKO.lokasi && TOKO.lokasi.alamat) || ''),
        alamatDelivery: alamatDeliverySimpan
      };
      try { localStorage.removeItem('katalog-pembeli'); } catch (errSimpan) {}

      var itemsSalin = keranjang.map(function (i) {
        return { id: i.id, nama: i.nama, label: i.label || '', harga: i.harga, qty: i.qty };
      });
      var kode = root.StrukKit ? root.StrukKit.buatKodePesanan(TOKO.nama) : 'ORD-' + Date.now();
      var pesanWA = buatPesan(itemsSalin, pb, TOKO, kode);
      var fileBuktiKirim = isQris ? buktiFileAktif : null;
      var dataUrlBuktiKirim = isQris ? buktiDataUrlAktif : '';

      var pesanan = {
        kode: kode,
        created_at: new Date().toISOString(),
        nama: pb.nama,
        catatan: pb.catatan,
        pengiriman: t.pengirimanLabel,
        alamat: pb.alamat,
        subtotal: t.subtotal,
        ongkir: t.ongkir,
        metode_bayar: isQris ? 'QRIS DANA' : (isCod ? 'COD (Bayar di Tempat)' : 'Bayar di Stan'),
        status_bayar: isQris ? 'Menunggu Verifikasi' : 'Belum Bayar',
        bukti_bayar: dataUrlBuktiKirim,
        items: itemsSalin,
        total: t.total,
        status: 'Baru',
        pesan_wa: pesanWA
      };

      btn.textContent = 'Membuat struk…';
      var proses = root.StrukKit ? root.StrukKit.simpanPesanan(pesanan, TOKO) : Promise.resolve({ ok: true, mode: 'lokal', data: pesanan });
      proses.then(function (hasil) {
        btn.innerHTML = labelAsli;
        keranjang = [];
        resetFormPembeli();
        simpan();
        bukaLaci(false);
        bukaStruk(pesanan, hasil, fileBuktiKirim);
        sinkronkanStok(true);
        if (hasil && hasil.error) toast('Struk dibuat (simpan lokal — cek pengaturan Supabase)');
      });
    });
  };
  $('#btnTema').onclick = function () {
    var gelap = document.documentElement.getAttribute('data-mode') !== 'gelap';
    document.documentElement.setAttribute('data-mode', gelap ? 'gelap' : 'terang');
    try { localStorage.setItem('katalog-tema', gelap ? 'gelap' : 'terang'); } catch (er) {}
  };

  if (TOKO.sheetCSV) {
    fetch(TOKO.sheetCSV).then(function (r) { return r.text(); }).then(function (t) { var p = produkDariCSV(t); if (p.length) PRODUK = p; mulai(); })
      .catch(function () { toast('Gagal memuat Google Sheet, pakai data lokal'); mulai(); });
  } else mulai();

  // ---------- Tema (customizer Maliki Studio, lihat tema.css & tema.js) ----------
  var FONT_OK = ['Plus Jakarta Sans', 'Inter', 'Poppins', 'DM Sans', 'Space Grotesk', 'Nunito'];
  function terapkanTema(t) {
    var r = document.documentElement, st = r.style;
    if (t.utama) st.setProperty('--tema-utama', t.utama);
    if (t.aksen) st.setProperty('--tema-aksen', t.aksen);
    if (t.radius != null) st.setProperty('--tema-radius', typeof t.radius === 'number' ? t.radius + 'px' : t.radius);
    if (t.font) {
      var f = String(t.font).split(',')[0].replace(/["']/g, '').trim();
      st.setProperty('--tema-font', '"' + f + '", system-ui, sans-serif');
      var l = document.getElementById('fontTema');
      if (l && FONT_OK.indexOf(f) >= 0) l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@400;500;600;700;800&display=swap';
    }
    if (t.mode) r.setAttribute('data-mode', t.mode === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang') : t.mode);
    if (t.bagian) terapkanBagian(t.bagian);
    setTimeout(hitungTeksBagian, 0);
    if (t.nama) {
      TOKO.nama = t.nama;
      Array.prototype.forEach.call(document.querySelectorAll('[data-tema-nama]'), function (e) { e.textContent = t.nama; });
      var ik = document.querySelector('.merek-ikon'); if (ik && !ik.classList.contains('ada-logo')) ik.textContent = t.nama.charAt(0);
    }
  }
  window.addEventListener('message', function (e) { if (e.data && e.data.tipe === 'tema') terapkanTema(e.data); });
  var PETA_BAGIAN = {
    nav: '.kepala',
    latar: 'main, .kaki',
    panel: '.kartu, .kartu-gambar, .sorotan-kartu, .lokasi-kartu, .modal, .laci, .saring input, .saring select, .ikon-btn',
    utama: '.tombol, .lokasi-btn, .merek-ikon, .pembuka em, .kat.aktif, .kartu-plus, .keranjang-btn',
    aksen: '.label, .hitung, .sorotan-info small, .pembuka-titik, .lokasi-tag',
    teks: 'h1, h2, h3, .pembuka p, .harga'
  };
  var NAMA_BAGIAN = { nav: 'Navigasi', latar: 'Latar', panel: 'Panel', utama: 'Warna utama', aksen: 'Aksen', teks: 'Teks' };
  var VAR_BAGIAN = { latar: '--latar', panel: '--kartu', nav: '--nav', teks: '--teks' };
  function tandaiBagian() {
    var baru = 0;
    Object.keys(PETA_BAGIAN).forEach(function (b) {
      Array.prototype.forEach.call(document.querySelectorAll(PETA_BAGIAN[b]), function (el) { if (!el.hasAttribute('data-bagian')) { el.setAttribute('data-bagian', b); baru++; } });
    });
    if (baru && sorotAktif) sorot(sorotAktif);
  }
  function warnaNyata(v) {
    var p = document.createElement('i'); p.style.cssText = 'position:absolute;width:0;height:0;background:var(' + v + ')';
    document.body.appendChild(p); var c = getComputedStyle(p).backgroundColor; p.remove();
    var m = c.match(/[\d.]+/g) || [255, 255, 255];
    if (/^color\(srgb/.test(c)) m = m.map(function (x) { return x * 255; });
    return m.slice(0, 3).map(Number);
  }
  function teksUntuk(v) {
    var l = warnaNyata(v).map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    var L = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    return L > 0.4 ? '#14171a' : '#ffffff';
  }
  function hitungTeksBagian() {
    if (!document.body) return;
    var st = document.documentElement.style;
    st.setProperty('--tema-nav-teks', teksUntuk('--nav'));
    st.setProperty('--tema-utama-teks', teksUntuk('--utama'));
    st.setProperty('--tema-tombol-teks', teksUntuk('--tombol'));
  }
  function terapkanBagian(bg) {
    var st = document.documentElement.style;
    Object.keys(VAR_BAGIAN).forEach(function (k) {
      if (bg[k] === undefined) return;
      if (bg[k]) { st.setProperty('--tema-' + k, bg[k]); st.setProperty(VAR_BAGIAN[k], bg[k]); }
      else { st.removeProperty('--tema-' + k); st.removeProperty(VAR_BAGIAN[k]); }
    });
  }
  var sorotAktif = null;
  function sorot(b) {
    sorotAktif = b;
    Array.prototype.forEach.call(document.querySelectorAll('[data-sorot]'), function (e) { e.removeAttribute('data-sorot'); });
    Array.prototype.forEach.call(document.querySelectorAll('.label-sorot'), function (e) { e.remove(); });
    if (!b) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-bagian="' + b + '"]'), function (e) {
      e.setAttribute('data-sorot', '');
      var r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
      var lb = document.createElement('span'); lb.className = 'label-sorot'; lb.textContent = NAMA_BAGIAN[b] || b;
      lb.style.left = Math.max(2, r.left + 4) + 'px'; lb.style.top = Math.max(2, r.top + 4) + 'px';
      document.body.appendChild(lb);
    });
  }
  var modePilih = false, hoverEl = null;
  function bagianDari(t) { return t && t.closest ? t.closest('[data-bagian]') : null; }
  function setPilih(on) {
    modePilih = !!on; document.documentElement.classList.toggle('mode-pilih', modePilih);
    if (!modePilih && hoverEl) { hoverEl.removeAttribute('data-pilih-hover'); hoverEl = null; }
  }
  ['click', 'pointerdown', 'mousedown', 'touchstart', 'submit', 'keydown'].forEach(function (tipe) {
    document.addEventListener(tipe, function (e) {
      if (!modePilih) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (tipe === 'click') { var el = bagianDari(e.target); if (el) parent.postMessage({ tipe: 'bagian-dipilih', bagian: el.getAttribute('data-bagian') }, '*'); }
    }, { capture: true, passive: false });
  });
  document.addEventListener('mouseover', function (e) {
    if (!modePilih) return; var el = bagianDari(e.target);
    if (hoverEl && hoverEl !== el) hoverEl.removeAttribute('data-pilih-hover');
    hoverEl = el; if (el) el.setAttribute('data-pilih-hover', '');
  }, true);
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d) return;
    if (d.tipe === 'sorot') sorot(d.bagian || null);
    else if (d.tipe === 'mode-pilih') setPilih(d.aktif);
  });
  new MutationObserver(function (ms) {
    var mode = ms.some(function (m) { return m.type === 'attributes'; });
    var dom = ms.some(function (m) { return m.type === 'childList' && Array.prototype.some.call(m.addedNodes, function (n) { return n.nodeType === 1 && n.className !== 'label-sorot'; }); });
    if (dom) tandaiBagian(); if (mode) hitungTeksBagian();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mode'] });
  tandaiBagian(); hitungTeksBagian();
})(typeof window !== 'undefined' ? window : this);