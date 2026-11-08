-- 004: Penyesuaian PIN bawaan 123456 (wajib Reset PIN sekali, lalu Ganti PIN).
--
-- Aman dijalankan pada keadaan 003 versi mana pun, dan aman diulang:
--  * 003 versi LAMA (PIN boleh kosong, ada set_initial_pin/pin_status): dibawa ke model PIN bawaan.
--    Lingkungan yang sudah sempat memilih PIN sendiri TETAP memakai PIN-nya (tidak dipaksa ganti lagi);
--    yang PIN-nya kosong diberi PIN bawaan 123456 dan wajib Reset PIN.
--  * 003 versi TERBARU: tidak ada yang berubah (hanya memastikan fungsi terbaru terpasang).
--
-- Jalankan di Supabase SQL Editor bila login PWA bermasalah (mis. berhasil masuk lalu kembali ke /masuk),
-- atau bila Anda tidak yakin versi 003 mana yang dijalankan.

-- 1. Kolom penanda "masih PIN bawaan"
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'lingkungan' and column_name = 'pin_wajib_ganti'
  ) then
    -- baris lama yang sudah punya PIN = PIN pilihan pengguna, jadi tidak wajib ganti
    alter table lingkungan add column pin_wajib_ganti boolean not null default false;
    update lingkungan
       set pin_hash = extensions.crypt('123456', extensions.gen_salt('bf')), pin_wajib_ganti = true
     where pin_hash is null;
  end if;
end $$;

update lingkungan
   set pin_hash = extensions.crypt('123456', extensions.gen_salt('bf')), pin_wajib_ganti = true
 where pin_hash is null;

alter table lingkungan alter column pin_wajib_ganti set default true;
alter table lingkungan alter column pin_hash set default extensions.crypt('123456', extensions.gen_salt('bf'));
alter table lingkungan alter column pin_hash set not null;

-- 2. Buang fungsi model lama
drop function if exists pin_status(uuid);
drop function if exists set_initial_pin(uuid, text);

-- 3. Fungsi PIN terbaru. Kode hasil: > 0 berhasil (versi PIN); -1 salah; -2 terkunci; -5 tidak ada/nonaktif.
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

-- Reset PIN pertama (dari bawaan) dan Ganti PIN: PIN lama 1x, PIN baru 2x (pengulangan dicek di aplikasi).
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

-- Reset oleh Admin / Admin Keuangan: kembali ke 123456 dan wajib diganti; semua perangkat lingkungan itu keluar.
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

-- 4. Hanya server (service role) yang boleh memanggil fungsi.
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
