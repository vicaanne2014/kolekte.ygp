-- 003: Lingkungan/Wilayah jadi master data (CRUD oleh Admin) + PIN masuk PWA per lingkungan.
--
-- Jalankan SETELAH 001 dan 002, cukup SEKALI. Sesi yang sudah ada dipertahankan
-- (nama lingkungan lama dipetakan ke baris master).
--
-- PIN: 6 angka, disimpan sebagai hash (bcrypt). Semua lingkungan diawali PIN bawaan 123456 dan WAJIB menggantinya
-- saat pertama masuk ("Reset PIN"); sesudahnya tombolnya menjadi "Ganti PIN". Ganti PIN = PIN lama 1x + PIN baru 2x.
-- Admin dapat mereset PIN lingkungan: kembali ke 123456 dan wajib diganti lagi.
-- 5 kali salah berturut-turut mengunci lingkungan itu 15 menit.

-- 1. Master lingkungan (+ kolom PIN)
create table lingkungan (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null unique,
  urutan          integer not null default 0,
  aktif           boolean not null default true,
  pin_hash        text not null default extensions.crypt('123456', extensions.gen_salt('bf')),  -- bawaan 123456
  pin_wajib_ganti boolean not null default true,        -- true = masih PIN bawaan, wajib diganti
  pin_version     integer not null default 1,           -- naik tiap PIN diganti/direset (membatalkan sesi lama)
  gagal           integer not null default 0,
  terkunci_sampai timestamptz
);
alter table lingkungan enable row level security;

insert into lingkungan (nama, urutan) values
  ('Sta. Felisitas',           1),
  ('St. Edmund',               2),
  ('St. Hieronimus',           3),
  ('St. Fransiscus Xaverius',  4),
  ('Sta. Veronica',            5),
  ('Sta. Maria Ratu Rosari',   6),
  ('Sta. Maria Medali Wasiat', 7),
  ('OMK',                      8),
  ('WKRI',                     9)
on conflict (nama) do nothing;

-- 2. Sesi menunjuk ke master (lingkungan_id), bukan teks nama
alter table kolekte_session add column lingkungan_id uuid references lingkungan(id);
update kolekte_session k set lingkungan_id = l.id from lingkungan l where l.nama = k.lingkungan;
alter table kolekte_session alter column lingkungan_id set not null;

drop function if exists open_session(text, date, uuid, text, text);
alter table kolekte_session drop column lingkungan;   -- ikut menghapus constraint dan indeks lama
create unique index ux_kolekte_session
  on kolekte_session (lingkungan_id, tanggal, misa_id, (coalesce(kategori, '')));
drop function if exists valid_lingkungan(text);

-- 3. open_session: lingkungan dari master
create or replace function open_session(
  p_lingkungan uuid, p_tanggal date, p_misa uuid, p_kategori text, p_nama text
) returns uuid language plpgsql as $$
declare v_id uuid; v_jenis text;
begin
  if char_length(btrim(coalesce(p_nama,''))) not between 2 and 60 then raise exception 'NAMA_INVALID'; end if;
  if p_tanggal is null or p_tanggal > (now() at time zone 'Asia/Jakarta')::date + 1 then
    raise exception 'TANGGAL_INVALID';
  end if;
  if not exists (select 1 from lingkungan where id = p_lingkungan and aktif) then
    raise exception 'LINGKUNGAN_INVALID';
  end if;

  select jenis into v_jenis from misa where id = p_misa and aktif;
  if not found then raise exception 'MISA_INVALID'; end if;

  p_kategori := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_jenis = 'JUMAT_PERTAMA' then
    p_kategori := null;
  elsif p_kategori is null or p_kategori not in ('SABTU_SORE', 'MINGGU_1', 'MINGGU_2') then
    raise exception 'KATEGORI_INVALID';
  end if;

  insert into kolekte_session (lingkungan_id, tanggal, misa_id, kategori, created_by_name)
  values (p_lingkungan, p_tanggal, p_misa, p_kategori, btrim(p_nama))
  on conflict (lingkungan_id, tanggal, misa_id, (coalesce(kategori, ''))) do nothing;

  select id into v_id from kolekte_session
   where lingkungan_id = p_lingkungan and tanggal = p_tanggal and misa_id = p_misa
     and kategori is not distinct from p_kategori;
  return v_id;
end $$;

-- 4. PIN. Kode hasil (integer): > 0 = berhasil (versi PIN); -1 salah; -2 terkunci; -5 lingkungan tidak ada/nonaktif.
--    Sengaja mengembalikan kode (bukan raise) agar hitungan gagal tetap tersimpan.

create or replace function check_pin(p_lingkungan uuid, p_pin text) returns integer
language plpgsql as $$
declare r lingkungan%rowtype;
begin
  select * into r from lingkungan where id = p_lingkungan and aktif for update;
  if not found then return -5; end if;
  if r.terkunci_sampai is not null and r.terkunci_sampai > now() then return -2; end if;

  if coalesce(p_pin, '') ~ '^[0-9]{6}$' and r.pin_hash = extensions.crypt(p_pin, r.pin_hash) then
    update lingkungan set gagal = 0, terkunci_sampai = null where id = p_lingkungan;
    return r.pin_version;
  end if;

  if r.gagal + 1 >= 5 then
    update lingkungan set gagal = 0, terkunci_sampai = now() + interval '15 minutes' where id = p_lingkungan;
    return -2;
  end if;
  update lingkungan set gagal = r.gagal + 1 where id = p_lingkungan;
  return -1;
end $$;

-- Reset PIN pertama (dari bawaan) maupun Ganti PIN: PIN lama 1x (diperiksa di sini); PIN baru diulang 2x (diperiksa di aplikasi).
create or replace function change_pin(p_lingkungan uuid, p_old text, p_new text) returns integer
language plpgsql as $$
declare v integer;
begin
  if coalesce(p_new, '') !~ '^[0-9]{6}$' then raise exception 'PIN_INVALID'; end if;
  if p_new = '123456' then raise exception 'PIN_DEFAULT'; end if;
  v := check_pin(p_lingkungan, p_old);
  if v < 0 then return v; end if;
  update lingkungan
     set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf')),
         pin_wajib_ganti = false, pin_version = pin_version + 1
   where id = p_lingkungan
  returning pin_version into v;
  return v;
end $$;

-- Reset oleh Admin / Admin Keuangan: kembali ke PIN bawaan 123456 dan wajib diganti;
-- semua perangkat lingkungan itu keluar.
create or replace function bo_reset_pin(p_lingkungan uuid, p_user uuid) returns void
language plpgsql as $$
begin
  if not exists (select 1 from bo_user where user_id = p_user) then raise exception 'FORBIDDEN'; end if;
  update lingkungan
     set pin_hash = extensions.crypt('123456', extensions.gen_salt('bf')), pin_wajib_ganti = true,
         pin_version = pin_version + 1, gagal = 0, terkunci_sampai = null
   where id = p_lingkungan;
  if not found then raise exception 'LINGKUNGAN_INVALID'; end if;
end $$;

-- 5. Hanya server (service role) yang boleh memanggil fungsi.
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
