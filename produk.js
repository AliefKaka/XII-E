/* kredit-maliki: Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id. Lisensi Nonkomersial Maliki Studio: wajib kredit, dilarang dijual (lihat LICENSE). */
/* =========================================================
   PENGATURAN TOKO & DATA PRODUK — cukup ubah berkas ini.
   ========================================================= */
window.TOKO = {
  nama: (window.TEMA && TEMA.nama) || 'D SECO', // nama toko diambil dari tema.js
  slogan: 'Lezat Dan Bergizi',
  // Nomor WhatsApp format internasional tanpa + dan tanpa spasi (62 = Indonesia)
  wa: '6285852848253',
  mataUang: 'Rp',
  // LOKASI TOKO / STAN (Takeaway) — atur koordinat lat & lng sesuka hati.
  // Cara dapat koordinat: buka Google Maps → klik kanan lokasi stan → salin angka koordinat (lat, lng).
  lokasi: {
    nama: 'D SECO',
    alamat: 'JI. AR Hakim No.04, Ditotrunan, Kec. Lumajang, Kabupaten Lumajang, Jawa Timur 67316 (sebelah CABDIN)',
    jamBuka: 'jumat, 06.00 – 15.15 WIB',
    lat: -8.137445,
    lng: 113.223003
  },
  // SUPABASE VIA VERCEL ENVIRONMENT VARIABLES (disarankan):
  // Biarkan url & anonKey kosong di sini lalu atur SUPABASE_URL dan SUPABASE_ANON_KEY di Vercel
  // (Settings -> Environment Variables). Browser akan otomatis memakai endpoint /api/pesanan.
  supabase: {
    apiEndpoint: '/api/pesanan',
    url: '',      // Opsional jika tidak pakai Vercel: 'https://xxxxxxxxxxxx.supabase.co' (tanpa /rest/v1)
    anonKey: '',  // Opsional jika tidak pakai Vercel: Publishable key 'sb_publishable_...'
    tabel: 'pesanan'
  },
  // AKUN ADMIN — digunakan untuk masuk ke halaman admin.html
  admin: {
    username: 'admin',
    pin: '362008'
  },
  // OPSIONAL: ambil produk dari Google Sheet (File → Bagikan → Publikasikan ke web → CSV).
  // Kolom: id,nama,kategori,harga,hargaCoret,deskripsi,varian,gambar,stok,label
  // varian: "Ukuran:S,M,L;Warna:Hitam,Putih"   gambar: url1|url2 (kosongkan = gambar ilustrasi)
  sheetCSV: '',
  // LOGO & FOTO — ganti cukup timpa berkas di img/ atau ubah path di sini.
  logo: 'img/logo.svg',              // tampil di header; kosongkan '' = inisial nama toko
  fotoKosong: 'img/foto-produk.svg'  // dipakai bila produk tanpa gambar / foto gagal dimuat
};

/* Gambar: isi dengan URL foto (mis. "img/kaos-1.jpg") ATAU objek ilustrasi
   { bentuk: 'kaos'|'tote'|'mug'|'topi'|'botol'|'buku'|'lilin'|'tas'|'tatakan', warna: '#hex', aksen: '#hex' }. */
window.PRODUK = [
  {
    id: 'dorayaki-lezat', nama: 'dorayaki', kategori: 'Makanan', harga: 3500, label: 'Terlaris', stok: 50,
    deskripsi: 'Dorayaki kue khas Jepang bertekstur lembut dengan isian manis yang lezat, cocok dinikmati sebagai camilan kapan saja',
    varian: [],
    gambar: ['img/dorayaki.jpg']
  },
  {
    id: 'sempol-gurih', nama: 'Sempol', kategori: 'Makanan', harga: 5000, stok: 50,
    deskripsi: 'Sempol jajanan gurih berbahan dasar ayam dan tepung yang digoreng hingga renyah di luar, lembut di dalam, dan nikmat di setiap gigitan.',
    varian: [],
    gambar: ['img/sempol.jpg']
  },
  {
    id: 'cincau-segar', nama: 'Es Capcin', kategori: 'Minuman', harga: 5000, stok: 50,
    deskripsi: 'Es Capcin perpaduan segarnya es, nikmatnya cappuccino, dan kenyalnya cincau yang menciptakan sensasi manis dan menyegarkan di setiap tegukan.',
    varian: [],
    gambar: ['img/es-cincau.jpg']
  }
];
