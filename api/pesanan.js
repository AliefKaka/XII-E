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

module.exports = async function handler(req, res) {
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
      var body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
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

    if (req.method === 'PATCH') {
      var patchBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      var idPatch = req.query && req.query.id;
      var kodePatch = req.query && req.query.kode;
      if (!idPatch && !kodePatch) {
        return res.status(400).json({ error: 'Parameter id atau kode wajib diisi.' });
      }
      var updateData = {};
      if (patchBody.status != null) updateData.status = patchBody.status;
      if (patchBody.status_bayar != null) updateData.status_bayar = patchBody.status_bayar;
      if (!Object.keys(updateData).length) updateData.status = 'Baru';

      var filterPatch = idPatch
        ? '?id=eq.' + encodeURIComponent(idPatch)
        : '?kode=eq.' + encodeURIComponent(kodePatch);
      var rPatch = await fetch(baseEndpoint + filterPatch, {
        method: 'PATCH',
        headers: buatHeader(key, { Prefer: 'return=representation' }),
        body: JSON.stringify(updateData)
      });
      var tPatch = await rPatch.text();
      res.status(rPatch.status).setHeader('Content-Type', 'application/json');
      return res.send(tPatch);
    }

    if (req.method === 'DELETE') {
      var idDel = req.query && req.query.id;
      var kodeDel = req.query && req.query.kode;
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

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method tidak didukung.' });
  } catch (err) {
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
};
