-- 005: Master Misa tidak lagi memakai urutan manual; daftar menampilkan yang paling baru ditambahkan di paling atas.
-- Menambah kolom waktu dibuat (created_at). Kolom `urutan` dibiarkan ada (tidak dipakai lagi untuk Misa).
--
-- Aman dijalankan berulang. Sebelum migrasi ini dijalankan, aplikasi tetap berfungsi (daftar misa diurutkan
-- menurut nama); setelah dijalankan, misa terbaru muncul paling atas.

alter table misa add column if not exists created_at timestamptz not null default now();

-- Isi awal untuk misa yang sudah ada: pertahankan urutan lama sebagai urutan pembuatan
-- (urutan 1,2,3,... = paling lama; yang urutannya 0 = ditambahkan belakangan lewat Back Office).
with u as (
  select id,
         row_number() over (order by (case when urutan = 0 then 1 else 0 end), urutan, nama) as n
    from misa
)
update misa m
   set created_at = now() - interval '1 hour' + (u.n * interval '1 second')
  from u
 where u.id = m.id
   and m.created_at >= now() - interval '5 minutes';   -- hanya baris yang baru saja diberi nilai bawaan
