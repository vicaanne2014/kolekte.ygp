-- 002: Master Misa = nama misa/perayaan (mis. "Minggu Biasa XXI", "Jumat Pertama bulan November").
--      Sabtu Sore / Minggu 1 / Minggu 2 menjadi pilihan tetap (kolom `kategori`), bukan master.
--      Setiap misa punya `jenis`: MINGGU (memakai kategori) atau JUMAT_PERTAMA (satu misa, tanpa kategori).
--      Pilihan bulan 1–12 dihapus.
--
-- Jalankan SETELAH 001_init.sql. Aman untuk database yang sudah berisi data:
-- sesi lama dipertahankan dan dipindah ke misa penampung "Misa Lama (data uji)".

-- 1. Kolom baru
alter table misa add column if not exists jenis text not null default 'MINGGU'
  check (jenis in ('MINGGU', 'JUMAT_PERTAMA'));
alter table kolekte_session add column if not exists kategori text;

-- 2. Misa penampung untuk sesi lama (nonaktif, tidak muncul di pilihan baru)
insert into misa (nama, urutan, aktif) values ('Misa Lama (data uji)', 0, false)
on conflict (nama) do nothing;

-- 3. Sesi lama: nama misa lama -> kategori; misa_id -> penampung
update kolekte_session k
   set kategori = case m.nama
                    when 'Sabtu Sore' then 'SABTU_SORE'
                    when 'Minggu 1'   then 'MINGGU_1'
                    when 'Minggu 2'   then 'MINGGU_2'
                    else null end,
       misa_id  = (select id from misa where nama = 'Misa Lama (data uji)')
  from misa m
 where m.id = k.misa_id
   and m.nama in ('Sabtu Sore', 'Minggu 1', 'Minggu 2', 'Jumat Pertama');

update kolekte_session
   set misa_id = (select id from misa where nama = 'Misa Lama (data uji)')
 where misa_id is null;

-- 4. Buang baris master lama dan kolom yang tidak dipakai lagi
delete from misa where nama in ('Sabtu Sore', 'Minggu 1', 'Minggu 2', 'Jumat Pertama');
alter table misa drop column if exists pilih_bulan;
alter table kolekte_session drop constraint if exists kolekte_session_jenis_chk;
alter table kolekte_session drop column if exists bulan;
alter table kolekte_session alter column misa_id set not null;

-- 5. Kategori dibatasi 3 nilai tetap (atau kosong untuk Jumat Pertama); keunikan sesi memuat kategori
alter table kolekte_session drop constraint if exists kolekte_session_kategori_chk;
alter table kolekte_session add constraint kolekte_session_kategori_chk
  check (kategori is null or kategori in ('SABTU_SORE', 'MINGGU_1', 'MINGGU_2'));

alter table kolekte_session drop constraint if exists kolekte_session_lingkungan_tanggal_misa_id_key;
drop index if exists ux_kolekte_session;
create unique index ux_kolekte_session
  on kolekte_session (lingkungan, tanggal, misa_id, (coalesce(kategori, '')));

-- 6. open_session: misa dari master + kategori (kecuali Jumat Pertama)
drop function if exists open_session(text, date, uuid, integer, text);

create or replace function open_session(
  p_lingkungan text, p_tanggal date, p_misa uuid, p_kategori text, p_nama text
) returns uuid language plpgsql as $$
declare v_id uuid; v_jenis text;
begin
  if char_length(btrim(coalesce(p_nama,''))) not between 2 and 60 then raise exception 'NAMA_INVALID'; end if;
  if p_tanggal is null or p_tanggal > (now() at time zone 'Asia/Jakarta')::date + 1 then
    raise exception 'TANGGAL_INVALID';
  end if;
  if not coalesce(valid_lingkungan(p_lingkungan), false) then raise exception 'LINGKUNGAN_INVALID'; end if;

  select jenis into v_jenis from misa where id = p_misa and aktif;
  if not found then raise exception 'MISA_INVALID'; end if;

  p_kategori := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_jenis = 'JUMAT_PERTAMA' then
    p_kategori := null;   -- Jumat Pertama: hanya satu misa, tanpa kategori
  elsif p_kategori is null or p_kategori not in ('SABTU_SORE', 'MINGGU_1', 'MINGGU_2') then
    raise exception 'KATEGORI_INVALID';
  end if;

  insert into kolekte_session (lingkungan, tanggal, misa_id, kategori, created_by_name)
  values (p_lingkungan, p_tanggal, p_misa, p_kategori, btrim(p_nama))
  on conflict (lingkungan, tanggal, misa_id, (coalesce(kategori, ''))) do nothing;

  select id into v_id from kolekte_session
   where lingkungan = p_lingkungan and tanggal = p_tanggal and misa_id = p_misa
     and kategori is not distinct from p_kategori;
  return v_id;
end $$;

-- 7. Contoh master Misa (ubah/tambah di Back Office -> Master Misa)
insert into misa (nama, jenis, urutan) values
  ('Minggu Kerahiman Ilahi',        'MINGGU',        1),
  ('Minggu Biasa XXI',              'MINGGU',        2),
  ('Minggu Advent 1',               'MINGGU',        3),
  ('Jumat Pertama bulan November',  'JUMAT_PERTAMA', 4)
on conflict (nama) do nothing;

-- 8. Hanya server (service role) yang boleh memanggil fungsi.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
