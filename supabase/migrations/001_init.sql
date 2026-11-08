-- Sistem Kolekte — skema + logika workflow (lihat docs/Technical_Logic_Sistem_Kolekte.md)
-- Jalankan di Supabase: SQL Editor -> paste -> Run.
-- Semua logika tulis ada di fungsi di bawah (atomik). Next.js hanya memanggilnya lewat service role.
--
-- Konstanta (bukan master data): 11 pecahan, 7 lingkungan, 4 jenis kantong.
-- Master data satu-satunya: tabel `misa` (dikelola Admin di Back Office).

-- ============ KONSTANTA ============
create or replace function valid_nilai(n integer) returns boolean
language sql immutable as $$
  select n in (100000, 75000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100)
$$;

create or replace function valid_lingkungan(s text) returns boolean
language sql immutable as $$
  select s in ('Sta. Felisitas', 'St. Edmund', 'St. Hieronimus', 'St. Fransiscus Xaverius',
               'Sta. Veronica', 'Sta. Maria Ratu Rosari', 'Sta. Maria Medali Wasiat')
$$;

-- ============ TABEL ============
create table misa (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null unique,
  pilih_bulan boolean not null default false,   -- true = minta bulan 1–12 (Jumat Pertama)
  urutan      integer not null default 0,
  aktif       boolean not null default true
);

create table kolekte_session (
  id              uuid primary key default gen_random_uuid(),
  lingkungan      text not null check (valid_lingkungan(lingkungan)),
  tanggal         date not null,
  misa_id         uuid not null references misa(id),
  bulan           integer check (bulan between 1 and 12),
  status          text not null default 'IN_PROGRESS'
                  check (status in ('IN_PROGRESS','READY_FOR_REVIEW','RETURNED','CLOSED')),
  grand_total     bigint not null default 0,
  created_by_name text not null,
  created_at      timestamptz not null default now(),
  closed_at       timestamptz,
  unique (lingkungan, tanggal, misa_id)
);

create table section (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references kolekte_session(id) on delete cascade,
  tipe            text not null check (tipe in ('RED','YELLOW','PARKIR','INTENSI')),
  status          text not null default 'DRAFT'
                  check (status in ('DRAFT','SUBMITTED','APPROVED')),
  is_empty        boolean not null default false,
  note            text,                       -- catatan Return dari Admin Keuangan
  subtotal        bigint not null default 0,
  created_by_name text,
  submitted_at    timestamptz,
  updated_at      timestamptz not null default now(),
  unique (session_id, tipe)
);

create table section_line (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references section(id) on delete cascade,
  nilai       integer not null check (valid_nilai(nilai)),
  qty         integer not null check (qty > 0),
  nilai_baris bigint  not null,                 -- nilai * qty
  unique (section_id, nilai)
);

create table section_review (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references section(id) on delete cascade,
  reviewer_name text not null,
  aksi          text not null check (aksi in ('APPROVE','EDIT')),
  note          text,                           -- untuk EDIT: "Subtotal lama -> baru"
  waktu         timestamptz not null default now()
);

create table session_review (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references kolekte_session(id) on delete cascade,
  reviewer_id uuid not null,
  aksi        text not null check (aksi in ('APPROVE','RETURN')),
  note        text,
  sections    text[],
  grand_total bigint not null,
  waktu       timestamptz not null default now()
);

-- Pengguna Back Office (login lewat Supabase Auth)
create table bo_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null check (role in ('ADMIN','ADMIN_KEUANGAN'))
);

-- Akses data hanya lewat server (service role). Tanpa policy = anon/authenticated ditolak.
alter table misa            enable row level security;
alter table kolekte_session enable row level security;
alter table section         enable row level security;
alter table section_line    enable row level security;
alter table section_review  enable row level security;
alter table session_review  enable row level security;
alter table bo_user         enable row level security;

-- ============ FUNGSI BANTU ============
create or replace function recompute_total(p_session uuid) returns void
language sql as $$
  update kolekte_session
     set grand_total = coalesce((select sum(subtotal) from section where session_id = p_session), 0)
   where id = p_session;
$$;

-- Keempat bagian (RED, YELLOW, PARKIR, INTENSI) wajib ada dan Approved.
-- Bagian bernilai 0 tetap wajib: disubmit dengan tanda "Kosong" (is_empty).
create or replace function is_ready(p_session uuid) returns boolean
language sql stable as $$
  select (select count(*) from section
           where session_id = p_session and status = 'APPROVED') = 4;
$$;

-- ============ PWA: PEMBUAT ============
create or replace function open_session(
  p_lingkungan text, p_tanggal date, p_misa uuid, p_bulan integer, p_nama text
) returns uuid language plpgsql as $$
declare v_id uuid; v_pilih boolean;
begin
  if char_length(btrim(coalesce(p_nama,''))) not between 2 and 60 then raise exception 'NAMA_INVALID'; end if;
  if p_tanggal is null or p_tanggal > (now() at time zone 'Asia/Jakarta')::date + 1 then
    raise exception 'TANGGAL_INVALID';
  end if;
  if not coalesce(valid_lingkungan(p_lingkungan), false) then raise exception 'LINGKUNGAN_INVALID'; end if;
  select pilih_bulan into v_pilih from misa where id = p_misa and aktif;
  if not found then raise exception 'MISA_INVALID'; end if;
  if v_pilih then
    if p_bulan is null or p_bulan not between 1 and 12 then raise exception 'BULAN_INVALID'; end if;
  else
    p_bulan := null;
  end if;

  insert into kolekte_session (lingkungan, tanggal, misa_id, bulan, created_by_name)
  values (p_lingkungan, p_tanggal, p_misa, p_bulan, btrim(p_nama))
  on conflict (lingkungan, tanggal, misa_id) do nothing;

  select id into v_id from kolekte_session
   where lingkungan = p_lingkungan and tanggal = p_tanggal and misa_id = p_misa;
  return v_id;
end $$;

-- Validasi + ganti seluruh baris section. Mengembalikan subtotal. Dipakai pembuat & pereview.
-- p_lines: [{"nilai": 50000, "qty": 3}, ...]  (snapshot penuh)
create or replace function replace_lines(p_section uuid, p_is_empty boolean, p_lines jsonb)
returns bigint language plpgsql as $$
declare v_el jsonb; v_qty int; v_n int := 0; v_sub bigint;
begin
  p_lines := coalesce(p_lines, '[]'::jsonb);
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'LINES_INVALID'; end if;

  for v_el in select value from jsonb_array_elements(p_lines) loop
    if coalesce(v_el->>'qty','') !~ '^[0-9]{1,7}$' then raise exception 'QTY_INVALID'; end if;
    v_qty := (v_el->>'qty')::int;
    if v_qty > 1000000 then raise exception 'QTY_INVALID'; end if;
    continue when v_qty = 0;
    v_n := v_n + 1;
    if coalesce(v_el->>'nilai','') !~ '^[0-9]{1,7}$' or not valid_nilai((v_el->>'nilai')::int) then
      raise exception 'DENOM_INVALID';
    end if;
  end loop;
  if p_is_empty and v_n > 0 then raise exception 'EMPTY_CONFLICT'; end if;

  delete from section_line where section_id = p_section;
  begin
    insert into section_line (section_id, nilai, qty, nilai_baris)
    select p_section, (e.value->>'nilai')::int, (e.value->>'qty')::int,
           (e.value->>'nilai')::bigint * (e.value->>'qty')::int
      from jsonb_array_elements(p_lines) e
     where (e.value->>'qty')::int > 0;
  exception when unique_violation then
    raise exception 'LINE_DUPLICATE';
  end;

  select coalesce(sum(nilai_baris), 0) into v_sub from section_line where section_id = p_section;
  update section set subtotal = v_sub, is_empty = p_is_empty, updated_at = now() where id = p_section;
  return v_sub;
end $$;

create or replace function save_section(
  p_session uuid, p_tipe text, p_nama text, p_is_empty boolean, p_lines jsonb
) returns void language plpgsql as $$
declare v_sstatus text; v_sec uuid; v_status text;
begin
  if p_tipe not in ('RED','YELLOW','PARKIR','INTENSI') then raise exception 'TIPE_INVALID'; end if;
  if char_length(btrim(coalesce(p_nama,''))) not between 2 and 60 then raise exception 'NAMA_INVALID'; end if;

  select status into v_sstatus from kolekte_session where id = p_session for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_sstatus = 'CLOSED' then raise exception 'SESSION_CLOSED'; end if;

  select id, status into v_sec, v_status from section
   where session_id = p_session and tipe = p_tipe for update;
  if not found then
    insert into section (session_id, tipe, created_by_name)
    values (p_session, p_tipe, btrim(p_nama)) returning id into v_sec;
    v_status := 'DRAFT';
  end if;
  if v_status in ('SUBMITTED','APPROVED') then raise exception 'SECTION_LOCKED'; end if;

  perform replace_lines(v_sec, p_is_empty, p_lines);

  if v_sstatus in ('RETURNED','READY_FOR_REVIEW') then
    update kolekte_session set status = 'IN_PROGRESS' where id = p_session;
  end if;
  perform recompute_total(p_session);
end $$;

create or replace function submit_section(p_session uuid, p_tipe text, p_nama text)
returns void language plpgsql as $$
declare v_sstatus text; v_sec uuid; v_status text; v_empty boolean; v_n int;
begin
  if char_length(btrim(coalesce(p_nama,''))) not between 2 and 60 then raise exception 'NAMA_INVALID'; end if;
  select status into v_sstatus from kolekte_session where id = p_session for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_sstatus = 'CLOSED' then raise exception 'SESSION_CLOSED'; end if;

  select id, status, is_empty into v_sec, v_status, v_empty from section
   where session_id = p_session and tipe = p_tipe for update;
  if not found then raise exception 'SECTION_EMPTY'; end if;
  if v_status <> 'DRAFT' then raise exception 'SECTION_NOT_DRAFT'; end if;

  select count(*) into v_n from section_line where section_id = v_sec;
  if v_n = 0 and not v_empty then raise exception 'SECTION_EMPTY'; end if;

  update section
     set status = 'SUBMITTED', created_by_name = btrim(p_nama),
         submitted_at = now(), updated_at = now()
   where id = v_sec;
end $$;

-- ============ PWA: PEREVIEW ============
-- Pereview mengedit isian yang sudah disubmit (sebelum approve). Status tetap SUBMITTED.
-- Pembuat dan pereview boleh orang yang sama.
create or replace function review_edit_section(
  p_section uuid, p_nama text, p_is_empty boolean, p_lines jsonb
) returns void language plpgsql as $$
declare v_sess uuid; v_status text; v_old bigint; v_new bigint; v_sstatus text;
begin
  if char_length(btrim(coalesce(p_nama,''))) not between 2 and 60 then raise exception 'NAMA_INVALID'; end if;

  select s.session_id, s.status, s.subtotal, k.status
    into v_sess, v_status, v_old, v_sstatus
    from section s join kolekte_session k on k.id = s.session_id
   where s.id = p_section
     for update of s, k;
  if not found then raise exception 'SECTION_NOT_SUBMITTED'; end if;
  if v_sstatus = 'CLOSED' then raise exception 'SESSION_CLOSED'; end if;
  if v_status <> 'SUBMITTED' then raise exception 'SECTION_NOT_SUBMITTED'; end if;

  v_new := replace_lines(p_section, p_is_empty, p_lines);
  if v_new = 0 and not p_is_empty then raise exception 'SECTION_EMPTY'; end if;

  insert into section_review (section_id, reviewer_name, aksi, note)
  values (p_section, btrim(p_nama), 'EDIT', 'Subtotal ' || v_old || ' -> ' || v_new);
  perform recompute_total(v_sess);
end $$;

-- Approve banyak bagian sekaligus (hasil checklist), atomik: semua berhasil atau tidak sama sekali.
create or replace function approve_sections(p_nama text, p_ids uuid[])
returns void language plpgsql as $$
declare r record; v_found int := 0; v_session uuid;
begin
  if char_length(btrim(coalesce(p_nama,''))) not between 2 and 60 then raise exception 'NAMA_INVALID'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'IDS_REQUIRED'; end if;

  for r in
    select s.id, s.status, s.session_id, k.status as sess_status
      from section s join kolekte_session k on k.id = s.session_id
     where s.id = any(p_ids)
     order by s.session_id, s.id
       for update of s, k
  loop
    v_found := v_found + 1;
    if r.sess_status = 'CLOSED' then raise exception 'SESSION_CLOSED'; end if;
    if r.status <> 'SUBMITTED' then raise exception 'SECTION_NOT_SUBMITTED'; end if;

    insert into section_review (section_id, reviewer_name, aksi) values (r.id, btrim(p_nama), 'APPROVE');
    update section set status = 'APPROVED', note = null, updated_at = now() where id = r.id;
  end loop;
  if v_found <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'SECTION_NOT_SUBMITTED';
  end if;

  for v_session in select distinct session_id from section where id = any(p_ids) loop
    if is_ready(v_session) then
      update kolekte_session set status = 'READY_FOR_REVIEW'
       where id = v_session and status in ('IN_PROGRESS','RETURNED');
    end if;
  end loop;
end $$;

-- ============ BACK OFFICE (hanya Admin Keuangan) ============
create or replace function bo_approve(p_session uuid, p_user uuid, p_note text)
returns void language plpgsql as $$
declare v_status text; v_total bigint; v_sum bigint;
begin
  if (select role from bo_user where user_id = p_user) is distinct from 'ADMIN_KEUANGAN' then
    raise exception 'FORBIDDEN';
  end if;
  select status, grand_total into v_status, v_total from kolekte_session where id = p_session for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status <> 'READY_FOR_REVIEW' or not is_ready(p_session) then raise exception 'NOT_READY'; end if;

  select coalesce(sum(l.nilai_baris), 0) into v_sum
    from section_line l join section s on s.id = l.section_id where s.session_id = p_session;
  if v_sum <> v_total then raise exception 'TOTAL_MISMATCH'; end if;

  insert into session_review (session_id, reviewer_id, aksi, note, grand_total)
  values (p_session, p_user, 'APPROVE', nullif(btrim(coalesce(p_note,'')), ''), v_total);
  update kolekte_session set status = 'CLOSED', closed_at = now() where id = p_session;
end $$;

create or replace function bo_return(p_session uuid, p_user uuid, p_sections text[], p_note text)
returns void language plpgsql as $$
declare v_status text; v_total bigint; v_n int;
begin
  if (select role from bo_user where user_id = p_user) is distinct from 'ADMIN_KEUANGAN' then
    raise exception 'FORBIDDEN';
  end if;
  if char_length(btrim(coalesce(p_note,''))) < 3 then raise exception 'NOTE_REQUIRED'; end if;
  if p_sections is null or cardinality(p_sections) = 0 then raise exception 'SECTIONS_REQUIRED'; end if;

  select status, grand_total into v_status, v_total from kolekte_session where id = p_session for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status <> 'READY_FOR_REVIEW' then raise exception 'NOT_READY'; end if;

  update section set status = 'DRAFT', note = btrim(p_note), updated_at = now()
   where session_id = p_session and tipe = any(p_sections) and status = 'APPROVED';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'SECTIONS_REQUIRED'; end if;

  insert into session_review (session_id, reviewer_id, aksi, note, sections, grand_total)
  values (p_session, p_user, 'RETURN', btrim(p_note), p_sections, v_total);
  update kolekte_session set status = 'RETURNED' where id = p_session;
end $$;

-- Fungsi hanya boleh dipanggil server (service role), bukan dari anon key di browser.
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

-- ============ SEED (master data Misa) ============
insert into misa (nama, pilih_bulan, urutan) values
  ('Sabtu Sore',    false, 1),
  ('Minggu 1',      false, 2),
  ('Minggu 2',      false, 3),
  ('Jumat Pertama', true,  4);

-- Buat user Back Office: Authentication -> Users -> Add user, lalu jalankan (ganti email):
-- insert into bo_user (user_id, role)
--   select id, 'ADMIN_KEUANGAN' from auth.users where email = 'keuangan@contoh.com';
