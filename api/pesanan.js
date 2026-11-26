/* Vercel Serverless Function: Proxy aman ke Supabase menggunakan Environment Variables Vercel.
   Variabel yang perlu diisi di Vercel -> Settings -> Environment Variables:
   - SUPABASE_URL       : Project URL Supabase (mis. https://xxxxxxxxxxxx.supabase.co)
   - SUPABASE_ANON_KEY  : Publishable key (sb_publishable_...) atau Secret/anon key
   - SUPABASE_TABEL     : (Opsional) nama tabel, bawaan 'pesanan' */

function bersihkanUrl(raw) {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '');
}

function buatHeader(key, extra) {
  var h = {
    apikey: key,
    'Content-Type': 'application/json'
  };
  if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key;
  if (extra) {
    Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
  }
  return h;
}

function ambilQueryParam(req, nama) {
  if (req && req.query && req.query[nama] != null && req.query[nama] !== '') {
    return String(req.query[nama]).trim();
  }
  try {
    var u = new URL((req && req.url) || '/', 'http://localhost');
    var v = u.searchParams.get(nama);
    return v != null && v !== '' ? String(v).trim() : '';
  } catch (e) {
    return '';
  }
}

function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
  }
  if (Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString('utf8') || '{}'); } catch (e) { return {}; }
  }
  return req.body;
}

async function kirimPatchSupabase(baseEndpoint, filterQuery, key, updateData) {
  var data = Object.assign({}, updateData);
  var percobaan = 0;

  while (percobaan < 6) {
    percobaan++;
    var r = await fetch(baseEndpoint + filterQuery, {
      method: 'PATCH',
      headers: buatHeader(key, { Prefer: 'return=representation' }),
      body: JSON.stringify(data)
    });
    var teks = await r.text();
    if (r.ok) {
      return { ok: true, status: r.status, text: teks };
    }
    // Jika skema tabel Supabase lama belum punya kolom opsional tertentu, buang kolom itu lalu coba lagi
    var matchKolom = teks.match(/Could not find the '([^']+)' column/i) || teks.match(/column "([^"]+)" of relation/i);
    if (r.status === 400 && matchKolom && matchKolom[1] && Object.prototype.hasOwnProperty.call(data, matchKolom[1])) {
      delete data[matchKolom[1]];
      if (!Object.keys(data).length) {
        return { ok: false, status: r.status, text: teks };
      }
      continue;
    }
    return { ok: false, status: r.status, text: teks };
  }

  return { ok: false, status: 400, text: JSON.stringify({ error: 'Gagal memperbarui kolom pesanan di Supabase.' }) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  var url = bersihkanUrl(process.env.SUPABASE_URL);
  var key = String(
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();
  var tabel = encodeURIComponent(String(process.env.SUPABASE_TABEL || 'pesanan').trim());

  if (!url || !key) {
    return res.status(503).json({
      error: 'Environment Variables SUPABASE_URL atau SUPABASE_ANON_KEY belum diatur di Vercel.'
    });
  }

  var baseEndpoint = url + '/rest/v1/' + tabel;

  try {
    if (req.method === 'GET') {
      var rGet = await fetch(baseEndpoint + '?select=*&order=created_at.desc', {
        method: 'GET',
        headers: buatHeader(key)
      });
      var tGet = await rGet.text();
      res.status(rGet.status).setHeader('Content-Type', 'application/json');
      return res.send(tGet);
    }

    if (req.method === 'POST') {
      var body = parseBody(req);
      var payload = {
        kode: body.kode,
        nama: body.nama,
        catatan: body.catatan || '',
        pengiriman: body.pengiriman || 'Takeaway (Ambil di Stan)',
        alamat: body.alamat || '',
        ongkir: Math.round(Number(body.ongkir) || 0),
        metode_bayar: body.metode_bayar || 'Bayar di Stan',
        status_bayar: body.status_bayar || 'Belum Bayar',
        bukti_bayar: body.bukti_bayar || '',
        items: Array.isArray(body.items) ? body.items : [],
        total: Math.round(Number(body.total) || 0),
        status: body.status || 'Baru',
        pesan_wa: body.pesan_wa || ''
      };
      var rPost = await fetch(baseEndpoint, {
        method: 'POST',
        headers: buatHeader(key, { Prefer: 'return=representation' }),
        body: JSON.stringify(payload)
      });
      var tPost = await rPost.text();
      res.status(rPost.status).setHeader('Content-Type', 'application/json');
      return res.send(tPost);
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      var patchBody = parseBody(req);
      var idPatch = ambilQueryParam(req, 'id') || (patchBody.id != null ? String(patchBody.id).trim() : '');
      var kodePatch = ambilQueryParam(req, 'kode') || (patchBody.kode != null ? String(patchBody.kode).trim() : '');
      if (!idPatch && !kodePatch) {
        return res.status(400).json({ error: 'Parameter id atau kode wajib diisi.' });
      }
      var updateData = {};
      if (patchBody.nama != null) updateData.nama = String(patchBody.nama).trim();
      if (patchBody.catatan != null) updateData.catatan = String(patchBody.catatan);
      if (patchBody.pengiriman != null) updateData.pengiriman = String(patchBody.pengiriman);
      if (patchBody.alamat != null) updateData.alamat = String(patchBody.alamat);
      if (patchBody.ongkir != null) updateData.ongkir = Math.round(Number(patchBody.ongkir) || 0);
      if (patchBody.metode_bayar != null) updateData.metode_bayar = String(patchBody.metode_bayar);
      if (patchBody.status_bayar != null) updateData.status_bayar = String(patchBody.status_bayar);
      if (Array.isArray(patchBody.items)) updateData.items = patchBody.items;
      if (patchBody.total != null) updateData.total = Math.round(Number(patchBody.total) || 0);
      if (patchBody.status != null) updateData.status = String(patchBody.status);
      if (patchBody.pesan_wa != null) updateData.pesan_wa = String(patchBody.pesan_wa);
      if (!Object.keys(updateData).length) {
        return res.status(400).json({ error: 'Tidak ada data perubahan yang dikirim.' });
      }

      var filterUtama = idPatch
        ? '?id=eq.' + encodeURIComponent(idPatch)
        : '?kode=eq.' + encodeURIComponent(kodePatch);

      var hasilPatch = await kirimPatchSupabase(baseEndpoint, filterUtama, key, updateData);

      // Fallback berdasarkan kode jika pencarian via id mengembalikan array kosong []
      if (hasilPatch.ok && idPatch && kodePatch) {
        try {
          var parsedRows = JSON.parse(hasilPatch.text || '[]');
          if (Array.isArray(parsedRows) && !parsedRows.length) {
            hasilPatch = await kirimPatchSupabase(baseEndpoint, '?kode=eq.' + encodeURIComponent(kodePatch), key, updateData);
          }
        } catch (eParse) {}
      }

      res.status(hasilPatch.status).setHeader('Content-Type', 'application/json');
      return res.send(hasilPatch.text);
    }

    if (req.method === 'DELETE') {
      var idDel = ambilQueryParam(req, 'id');
      var kodeDel = ambilQueryParam(req, 'kode');
      if (!idDel && !kodeDel) {
        return res.status(400).json({ error: 'Parameter id atau kode wajib diisi.' });
      }
      var filterDel = idDel
        ? '?id=eq.' + encodeURIComponent(idDel)
        : '?kode=eq.' + encodeURIComponent(kodeDel);
      var rDel = await fetch(baseEndpoint + filterDel, {
        method: 'DELETE',
        headers: buatHeader(key)
      });
      if (!rDel.ok) {
        var tDel = await rDel.text();
        return res.status(rDel.status).setHeader('Content-Type', 'application/json').send(tDel);
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, PUT, DELETE');
    return res.status(405).json({ error: 'Method tidak didukung.' });
  } catch (err) {
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
};
