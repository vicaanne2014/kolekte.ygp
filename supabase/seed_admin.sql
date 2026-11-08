-- Seeder akun Back Office (SQL). Jalankan di Supabase: SQL Editor -> paste -> Run.
-- Prasyarat: 001_init.sql sudah dijalankan (tabel bo_user ada).
--
-- LANGKAH: ganti v_email, v_password, dan v_role di bawah, lalu Run.
-- Aman dijalankan ulang: bila email sudah ada, hanya peran di bo_user yang diperbarui
-- (password TIDAK diubah). Jangan commit file ini setelah password diisi.
--
-- Catatan: skrip ini menulis langsung ke skema auth Supabase. Bila gagal (struktur auth
-- Supabase bisa berubah antarversi), buat user lewat Authentication -> Users -> Add user,
-- lalu jalankan hanya baris insert ke bo_user di paling bawah.

do $$
declare
  v_email    text := 'admin@kolekte.local';   -- << GANTI: email untuk login
  v_password text := 'GANTI_PASSWORD_INI';    -- << GANTI: minimal 8 karakter
  v_role     text := 'ADMIN_KEUANGAN';        -- ADMIN_KEUANGAN atau ADMIN
  v_id       uuid;
begin
  if v_role not in ('ADMIN', 'ADMIN_KEUANGAN') then
    raise exception 'Peran harus ADMIN atau ADMIN_KEUANGAN';
  end if;

  v_email := lower(btrim(v_email));
  select id into v_id from auth.users where lower(email) = v_email;

  if v_id is null then
    if v_password = 'GANTI_PASSWORD_INI' or char_length(v_password) < 8 then
      raise exception 'Isi v_password dengan password sendiri (minimal 8 karakter) sebelum Run';
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into bo_user (user_id, role) values (v_id, v_role)
  on conflict (user_id) do update set role = excluded.role;

  raise notice 'Akun Back Office siap: % (%)', v_email, v_role;
end $$;

-- Pengecekan: harus menampilkan 1 baris dengan email dan peran Anda.
-- select u.email, b.role from bo_user b join auth.users u on u.id = b.user_id;

-- CADANGAN (bila blok di atas gagal): buat user lewat dashboard Authentication -> Users,
-- lalu jalankan baris ini dengan email yang sama:
-- insert into bo_user (user_id, role)
--   select id, 'ADMIN_KEUANGAN' from auth.users where email = 'email-anda@contoh.com';
