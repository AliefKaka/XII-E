/* Modul Struk Digital (PDF/Print & PNG Canvas) + Bukti Transfer + Integrasi Supabase / Vercel API — proyek XII-E */
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

  function bacaLokal() {
    try {
      var raw = localStorage.getItem(KUNCI_RIWAYAT);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function tulisLokal(list) {
    try {
      localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify((list || []).slice(0, 100)));
    } catch (e) {
      // Jika storage penuh karena gambar bukti, simpan ulang tanpa gambar pada riwayat lama
      try {
        var ringkas = (list || []).slice(0, 50).map(function (x, idx) {
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
    var list = bacaLokal().filter(function (x) { return x.kode !== pesanan.kode; });
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

  function ambilSemuaPesanan(toko) {
    if (!supabaseAktif(toko) || typeof fetch !== 'function') {
      return Promise.resolve({ ok: true, mode: 'lokal', data: bacaLokal().map(normalisasiPesanan) });
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
      var list = Array.isArray(rows) ? rows.map(normalisasiPesanan) : [];
      return { ok: true, mode: 'supabase', data: list };
    }).catch(function (err) {
      return { ok: false, mode: 'lokal', data: bacaLokal().map(normalisasiPesanan), error: err && err.message ? err.message : String(err) };
    });
  }

  function patchPesanan(idAtauKode, perubahan, toko) {
    var list = bacaLokal();
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
    var list = bacaLokal().filter(function (x) {
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
    formatWaktu: formatWaktu,
    bersihkanBaseUrl: bersihkanBaseUrl,
    supabaseAktif: supabaseAktif,
    bacaLokal: bacaLokal,
    simpanPesanan: simpanPesanan,
    ambilSemuaPesanan: ambilSemuaPesanan,
    ubahStatusPesanan: ubahStatusPesanan,
    ubahStatusBayar: ubahStatusBayar,
    hapusPesanan: hapusPesanan,
    normalisasiPesanan: normalisasiPesanan,
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
