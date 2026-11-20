-- =========================================================
-- SKRIP PENYIAPAN TABEL SUPABASE — KATALOG TOKO XII-E (D SECO)
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================

create table if not exists public.pesanan (
  id bigint generated always as identity primary key,
  kode text not null unique,
  created_at timestamptz not null default now(),
  nama text not null,
  catatan text default '',
  pengiriman text not null default 'Takeaway (Ambil di Stan)',
  alamat text default '',
  ongkir bigint not null default 0,
  metode_bayar text not null default 'Bayar di Stan',
  status_bayar text not null default 'Belum Bayar',
  bukti_bayar text default '',
  items jsonb not null default '[]'::jsonb,
  total bigint not null default 0,
  status text not null default 'Baru',
  pesan_wa text default ''
);

-- Tambah kolom baru secara aman jika tabel pesanan sudah dibuat sebelumnya
alter table public.pesanan add column if not exists pengiriman text not null default 'Takeaway (Ambil di Stan)';
alter table public.pesanan add column if not exists alamat text default '';
alter table public.pesanan add column if not exists ongkir bigint not null default 0;
alter table public.pesanan add column if not exists metode_bayar text not null default 'Bayar di Stan';
alter table public.pesanan add column if not exists status_bayar text not null default 'Belum Bayar';
alter table public.pesanan add column if not exists bukti_bayar text default '';

-- Aktifkan Row Level Security (RLS)
alter table public.pesanan enable row level security;

-- Hapus policy lama jika skrip dijalankan ulang
drop policy if exists "izinkan_tambah_pesanan" on public.pesanan;
drop policy if exists "izinkan_baca_pesanan" on public.pesanan;
drop policy if exists "izinkan_ubah_status" on public.pesanan;
drop policy if exists "izinkan_hapus_pesanan" on public.pesanan;

-- Izinkan pembeli mengirim pesanan baru dari halaman katalog
create policy "izinkan_tambah_pesanan"
  on public.pesanan for insert
  to anon, authenticated
  with check (true);

-- Izinkan halaman admin membaca daftar pesanan
create policy "izinkan_baca_pesanan"
  on public.pesanan for select
  to anon, authenticated
  using (true);

-- Izinkan halaman admin mengubah status pesanan & status pembayaran
create policy "izinkan_ubah_status"
  on public.pesanan for update
  to anon, authenticated
  using (true)
  with check (true);

-- Izinkan halaman admin menghapus pesanan
create policy "izinkan_hapus_pesanan"
  on public.pesanan for delete
  to anon, authenticated
  using (true);

-- Pastikan role anon dan authenticated memiliki hak akses tabel & sequence
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.pesanan to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
