# Technical Logic — Sistem Kolekte

| Item | Isi |
|---|---|
| Versi | 0.5 — PIN awal 123456 wajib di-Reset sekali, lalu Ganti PIN (lama 1×, baru 2×) |
| Tanggal | 9 November 2026 |
| Dokumen induk | [PRD_Sistem_Kolekte.md](PRD_Sistem_Kolekte.md) |
| Stack | Next.js 15 (Server Actions) + Supabase (PostgreSQL + Auth) |
| Sumber kebenaran skema dan fungsi | Migrasi berurutan: [001_init.sql](../supabase/migrations/001_init.sql), [002_jumat_pertama_pilihan.sql](../supabase/migrations/002_jumat_pertama_pilihan.sql), [003_lingkungan_master_pin.sql](../supabase/migrations/003_lingkungan_master_pin.sql) |

Dokumen ini menjelaskan **logika teknis**: konstanta, rumus, validasi, perubahan status, masuk PWA dengan PIN, fungsi database, dan kasus tepi. DDL lengkap tidak disalin ke sini agar tidak berbeda dengan migrasi.

**Prinsip arsitektur:** seluruh aturan workflow dan PIN ada di **fungsi SQL** (atomik, satu transaksi). Next.js hanya memanggilnya lewat service role. Browser tidak punya akses ke tabel (RLS aktif tanpa policy) dan tidak bisa memanggil fungsi (hak `execute` dicabut dari `anon` dan `authenticated`).

---

## 1. 📌 Konstanta dan Master Data

### 1.1 Konstanta (bukan master data)

Didefinisikan di dua tempat yang harus selalu sama: kode (`src/lib/kolekte.ts`) untuk tampilan, dan SQL (`valid_nilai()`) untuk penegakan di database.

**Pecahan (11):** 100000, 75000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100. Rp75.000 adalah uang kertas peringatan. Rp1.000 satu baris (kertas dan koin dijumlahkan).

**Jenis kantong (4):** `RED` (Kantong Merah), `YELLOW` (Kantong Kuning), `PARKIR`, `INTENSI`. Tidak ada kategori di dalam kantong.

**Kategori misa (3):** `SABTU_SORE`, `MINGGU_1`, `MINGGU_2`. Hanya untuk misa berjenis MINGGU. Ada di `KATEGORI_MISA` (kode) dan constraint `kolekte_session_kategori_chk` (SQL).

Mengubah pecahan = ubah kode **dan** fungsi SQL `valid_nilai`. Tidak ada layar kelola.

### 1.2 Master data (dikelola Admin dan Admin Keuangan, CRUD)

**`lingkungan`** (Lingkungan/Wilayah)

| Kolom | Arti |
|---|---|
| `nama` | Unik. Data awal: Sta. Felisitas, St. Edmund, St. Hieronimus, St. Fransiscus Xaverius, Sta. Veronica, Sta. Maria Ratu Rosari, Sta. Maria Medali Wasiat, **OMK**, **WKRI** |
| `urutan`, `aktif` | Urutan tampil dan status |
| `pin_hash`, `pin_wajib_ganti`, `pin_version`, `gagal`, `terkunci_sampai` | PIN masuk PWA (Bagian 7). `pin_hash` awal = hash `123456`; `pin_wajib_ganti` = true selama masih PIN bawaan. Tidak pernah tampil di layar master |

**`misa`** (nama misa/perayaan)

| Kolom | Arti |
|---|---|
| `nama` | Unik. Mis. Minggu Kerahiman Ilahi, Minggu Biasa XXI, Minggu Advent 1, Jumat Pertama bulan November |
| `jenis` | `MINGGU` (memakai kategori Sabtu Sore/Minggu 1/Minggu 2) atau `JUMAT_PERTAMA` (satu misa, tanpa kategori). Dipilih Admin saat menambah misa |
| `urutan`, `aktif` | Urutan tampil dan status |

Jumat Pertama dicatat sebagai satu baris master per bulan (mis. "Jumat Pertama bulan Desember"); tidak ada pilihan bulan 1–12 terpisah.

**Hapus:** hanya bila belum dipakai. Database menolak (foreign key) bila data sudah dipakai sesi; aplikasi menampilkan "Data sudah dipakai… Nonaktifkan saja". Nonaktif menyembunyikan dari pilihan baru tanpa mengubah sesi lama.

---

## 2. 🧮 Rumus Perhitungan

Semua uang adalah **integer rupiah** (`bigint` di database). Tidak ada desimal dan tidak ada pembulatan.

```
nilai_baris        = nilai pecahan × qty
subtotal_section   = Σ nilai_baris        (semua baris section)
grand_total_sesi   = Σ subtotal_section   (RED + YELLOW + PARKIR + INTENSI)
rekap_pecahan      = Σ qty per (kantong, nilai)   (DIPISAH per kantong, tidak digabung lintas kantong)
```

Contoh (satu kantong): 2×100.000 + 2×75.000 + 4×50.000 + 10×20.000 + 7×10.000 + 12×5.000 + 5×2.000 + 30×1.000 + 8×500 + 5×200 + 10×100 = **926.000**.

**Sumber kebenaran:** klien hanya menampilkan estimasi. Server (`replace_lines`) menghitung ulang dari `(nilai, qty)` dan menyimpan `nilai_baris` dan `subtotal`. `bo_approve` memeriksa ulang bahwa `grand_total` sama dengan jumlah semua `nilai_baris`.

---

## 3. ✅ Aturan Validasi

### 3.1 Sesi (`open_session`)

| Kode | Aturan | Error |
|---|---|---|
| V-01 | Nama 2–60 karakter | `NAMA_INVALID` |
| V-02 | Tanggal terisi dan tidak lebih dari besok (zona Asia/Jakarta) | `TANGGAL_INVALID` |
| V-03 | Lingkungan ada dan aktif di master `lingkungan` (diambil dari login PWA, bukan dari isian form) | `LINGKUNGAN_INVALID` |
| V-04 | Misa ada dan aktif di master `misa` | `MISA_INVALID` |
| V-05 | Misa berjenis MINGGU: `kategori` wajib salah satu dari `SABTU_SORE`/`MINGGU_1`/`MINGGU_2`. Misa berjenis JUMAT_PERTAMA: `kategori` diabaikan (disimpan null) | `KATEGORI_INVALID` |
| V-06 | Unik `(lingkungan_id, tanggal, misa_id, coalesce(kategori, ''))`. Bila sudah ada, sesi yang ada dikembalikan (idempoten, bukan error) | — |

### 3.2 Baris input (`replace_lines`)

| Kode | Aturan | Error |
|---|---|---|
| V-10 | `qty` bilangan bulat 0–1.000.000 (regex `^[0-9]{1,7}$`) | `QTY_INVALID` |
| V-11 | `nilai` salah satu dari 11 pecahan tetap | `DENOM_INVALID` |
| V-12 | Tidak ada `nilai` ganda dalam satu section | `LINE_DUPLICATE` |
| V-13 | `is_empty` = true tidak boleh disertai qty > 0 | `EMPTY_CONFLICT` |
| V-14 | Baris dengan `qty = 0` dibuang, tidak disimpan | — |

### 3.3 Submit dan Review

| Kode | Aturan | Error |
|---|---|---|
| V-20 | Submit: section berstatus `DRAFT`, minimal satu baris atau `is_empty` | `SECTION_NOT_DRAFT`, `SECTION_EMPTY` |
| V-21 | Approve/Edit: section berstatus `SUBMITTED` | `SECTION_NOT_SUBMITTED` |
| V-22 | Edit: hasil edit tidak boleh nol baris tanpa `is_empty` | `SECTION_EMPTY` |
| V-23 | Sesi tidak `CLOSED` | `SESSION_CLOSED` |
| V-24 | Approve: daftar id tidak kosong dan semua id ditemukan | `IDS_REQUIRED`, `SECTION_NOT_SUBMITTED` |
| V-25 | Nama pereview 2–60 karakter | `NAMA_INVALID` |

Pembuat dan pereview boleh orang yang sama; keduanya tetap wajib mengetik nama.

### 3.4 Review total (BO)

| Kode | Aturan | Error |
|---|---|---|
| V-30 | Pengguna ada di `bo_user` dengan peran `ADMIN_KEUANGAN` | `FORBIDDEN` |
| V-31 | Sesi `READY_FOR_REVIEW` dan `is_ready` benar | `NOT_READY` |
| V-32 | Approve: total tersimpan = jumlah baris | `TOTAL_MISMATCH` |
| V-33 | Return: ≥ 1 bagian `APPROVED` dipilih, catatan ≥ 3 karakter | `SECTIONS_REQUIRED`, `NOTE_REQUIRED` |

### 3.5 PIN

| Kode | Aturan | Hasil |
|---|---|---|
| V-40 | PIN baru tepat 6 angka (`^[0-9]{6}$`) | `PIN_INVALID` |
| V-41 | PIN baru tidak boleh `123456` (PIN bawaan) | `PIN_DEFAULT` |
| V-42 | Pengulangan PIN baru harus sama (dicek di aplikasi sebelum memanggil SQL) | `PIN_MISMATCH` |
| V-43 | PIN lama harus benar (diperiksa `check_pin`; ikut hitungan gagal) | kode `-1` → `PIN_WRONG` |
| V-44 | Masuk gagal 5 kali berturut-turut → terkunci 15 menit | kode `-2` → `PIN_LOCKED` |

---

## 4. 🔁 Logika State

### 4.1 Section

| Dari | Aksi | Ke | Fungsi |
|---|---|---|---|
| (belum ada) | Simpan draft | DRAFT | `save_section` |
| DRAFT | Simpan draft | DRAFT | `save_section` |
| DRAFT | Submit | SUBMITTED | `submit_section` |
| SUBMITTED | Pereview edit | SUBMITTED | `review_edit_section` |
| SUBMITTED | Pereview approve | APPROVED | `approve_sections` |
| APPROVED | Return oleh Admin Keuangan | DRAFT | `bo_return` |
| SUBMITTED / APPROVED | Simpan draft | ditolak `SECTION_LOCKED` | `save_section` |

### 4.2 Sesi

| Dari | Pemicu | Ke |
|---|---|---|
| (baru) | `open_session` | IN_PROGRESS |
| IN_PROGRESS atau RETURNED | `approve_sections` membuat `is_ready` benar | READY_FOR_REVIEW |
| READY_FOR_REVIEW | `bo_approve` | CLOSED |
| READY_FOR_REVIEW | `bo_return` | RETURNED |
| RETURNED atau READY_FOR_REVIEW | `save_section` (bagian dibuka/dibuat lagi) | IN_PROGRESS |
| CLOSED | — | final |

### 4.3 `is_ready(session)`

```sql
-- Keempat bagian (RED, YELLOW, PARKIR, INTENSI) wajib ada dan APPROVED.
select (select count(*) from section where session_id = p and status = 'APPROVED') = 4;
```

Parkir dan Intensi **wajib**. Bila nilainya 0, bagian tetap dibuat lalu di-submit dengan `is_empty = true`, dan tetap harus di-approve.

---

## 5. 🗄️ Skema Ringkas

Tabel: `lingkungan`, `misa`, `kolekte_session`, `section`, `section_line`, `section_review`, `session_review`, `bo_user`.

| Tabel | Poin penting |
|---|---|
| `lingkungan` | Master + kolom PIN (Bagian 1.2 dan 7). |
| `kolekte_session` | `lingkungan_id` (FK, wajib), `tanggal`, `misa_id` (FK, wajib), `kategori` (nullable; null untuk Jumat Pertama), `status`, `grand_total`, `created_by_name`. Unik lewat indeks `ux_kolekte_session`. |
| `section` | Unik `(session_id, tipe)`. Status `DRAFT`/`SUBMITTED`/`APPROVED`. `created_by_name` diisi/ditimpa saat Submit. `note` untuk catatan Return. |
| `section_line` | Unik `(section_id, nilai)`. `nilai` dibatasi `valid_nilai`. Menyimpan `qty` dan `nilai_baris`. |
| `section_review` | `aksi` ∈ APPROVE, **EDIT**. EDIT menyimpan `note` "Subtotal lama -> baru". |
| `session_review` | `aksi` ∈ APPROVE, RETURN; menyimpan `grand_total` saat review dan bagian yang dibuka ulang. |
| `bo_user` | `user_id` (Supabase Auth) + `role` ∈ ADMIN, ADMIN_KEUANGAN. |

Data awal: 9 lingkungan (migrasi 003) dan 4 misa contoh (migrasi 002). Migrasi 003 memetakan sesi lama dari nama lingkungan ke `lingkungan_id` tanpa kehilangan data.

---

## 6. ⚙️ Fungsi dan Algoritma

Setiap fungsi berjalan dalam satu transaksi dan mengunci baris yang disentuh (`for update`).

| Halaman / aksi | Server Action | Fungsi SQL |
|---|---|---|
| `/masuk` masuk | `masuk` | `check_pin` |
| `/pin` Reset PIN (wajib sekali) / Ganti PIN | `gantiPin` | `change_pin` |
| `/` mulai sesi | `startSession` | `open_session` |
| `/s/{id}/{tipe}` simpan | `saveSection` (intent save) | `save_section` |
| `/s/{id}/{tipe}` submit | `saveSection` (intent submit) | `save_section` lalu `submit_section` |
| `/review` approve | `approveSections` | `approve_sections` |
| `/review/edit/{id}` simpan | `reviewEdit` | `review_edit_section` |
| `/hasil` lihat | (baca saja) | — |
| `/admin/{id}` approve / return | `approveSession` / `returnSession` | `bo_approve` / `bo_return` |
| `/admin/pin` reset | `resetPin` | `bo_reset_pin` |

### 6.1 Alur pengisian PWA (pembuat)

1. **Masuk:** pilih lingkungan + PIN 6 angka (Bagian 7).
2. **Data diri dan misa:** Nama, Tanggal, Misa (master), Sabtu Sore/Minggu 1/Minggu 2 (hanya misa Minggu) → `open_session` dengan `lingkungan_id` dari login.
3. **Pilih satu kantong**, masukkan qty per pecahan (11 baris), lalu **Submit**.

Setiap petugas memilih satu kantong, sehingga per sesi ada 4 `section`, masing-masing di-submit sendiri-sendiri.

### 6.2 `open_session(lingkungan_id, tanggal, misa, kategori, nama)`

```
1. validasi V-01…V-04
2. baca misa.jenis
   MINGGU        : kategori wajib salah satu dari 3 nilai tetap (KATEGORI_INVALID)
   JUMAT_PERTAMA : kategori dibuang (null)
3. insert … on conflict (lingkungan_id, tanggal, misa_id, coalesce(kategori, '')) do nothing
4. return id sesi (baru atau yang sudah ada), dicari dengan kategori IS NOT DISTINCT FROM p_kategori
```

### 6.3 `replace_lines(section, is_empty, lines)` (internal)

```
1. lines harus array; tiap elemen {nilai, qty}
2. validasi V-10, V-11, V-13 per elemen
3. delete semua baris section; insert baris baru dengan nilai_baris = nilai × qty
   (unique_violation → LINE_DUPLICATE)
4. subtotal = Σ nilai_baris; update section.subtotal dan is_empty
5. return subtotal
```

Klien mengirim **snapshot penuh** (bukan delta), sehingga aman bila request diulang.

### 6.4 `save_section(session, tipe, nama, is_empty, lines)`

```
1. validasi tipe, nama; kunci sesi (bukan CLOSED)
2. ambil atau buat section; tolak bila SUBMITTED/APPROVED (SECTION_LOCKED)
3. replace_lines
4. bila sesi RETURNED atau READY_FOR_REVIEW → IN_PROGRESS
5. recompute_total(sesi)
```

### 6.5 `submit_section(session, tipe, nama)`

```
validasi nama; sesi bukan CLOSED; section harus DRAFT;
harus ada ≥ 1 baris atau is_empty;
section → SUBMITTED, created_by_name = nama, submitted_at = now()
```

### 6.6 `review_edit_section(section, nama, is_empty, lines)` — Edit dulu

```
1. kunci section + sesi; sesi bukan CLOSED; section harus SUBMITTED
2. subtotal_lama = section.subtotal
3. replace_lines → subtotal_baru;  tolak bila 0 baris tanpa is_empty
4. insert section_review(aksi='EDIT', note='Subtotal lama -> baru')
5. recompute_total(sesi)
Status tetap SUBMITTED.
```

Pembuat tidak diberi notifikasi; edit hanya terlihat di Back Office ("Diedit oleh …").

### 6.7 `approve_sections(nama, ids[])` — Approve hasil checklist

```
1. validasi nama; ids tidak kosong
2. ambil semua section ids + sesinya, urut (session_id, id), kunci
3. untuk tiap section: sesi bukan CLOSED, status SUBMITTED
     → insert section_review('APPROVE'); section → APPROVED
4. jumlah section ditemukan harus sama dengan jumlah id unik
5. untuk tiap sesi terkait: bila is_ready dan status IN_PROGRESS/RETURNED → READY_FOR_REVIEW
Atomik: bila satu bagian gagal, tidak ada yang ter-approve.
```

Checklist diterapkan di UI (Approve nonaktif sampai semua bagian dalam daftar dicentang).

### 6.8 `bo_approve(session, user, note)` dan `bo_return(session, user, sections[], note)`

```
bo_approve: peran ADMIN_KEUANGAN; sesi READY_FOR_REVIEW dan is_ready;
            total tersimpan = Σ nilai_baris;
            insert session_review('APPROVE'); sesi → CLOSED, closed_at = now()
bo_return : peran ADMIN_KEUANGAN; catatan ≥ 3; sections tidak kosong; sesi READY_FOR_REVIEW;
            section terpilih yang APPROVED → DRAFT (note = catatan);
            bila tidak ada yang berubah → SECTIONS_REQUIRED;
            insert session_review('RETURN'); sesi → RETURNED
```

### 6.9 Hasil akhir per misa (PWA, baca saja, hanya lingkungan sendiri)

Halaman `/hasil` (GET: `tanggal`, `misa`) membaca sesi pada `(tanggal, misa_id, lingkungan_id = lingkungan login)` beserta bagian dan baris, lalu menampilkan:

- Total lingkungan dan berapa sesi yang sudah `CLOSED` (jumlah serta nilainya).
- Tabel kategori (Sabtu Sore/Minggu 1/Minggu 2 untuk misa Minggu; satu baris untuk Jumat Pertama) × (Merah, Kuning, Parkir, Intensi, Total, Status); kategori tanpa sesi tampil "Belum ada data".
- Rekap per pecahan **dipisah per kantong**: empat tabel (Merah, Kuning, Parkir, Intensi), masing-masing Σ qty dan nilai per pecahan plus total kantong. Tidak ada tabel gabungan semua kantong.

Lintas lingkungan hanya tersedia di Back Office. Finalisasi tetap `bo_approve` oleh Admin Keuangan.

### 6.10 Master data (Back Office)

- Halaman `/admin/master/lingkungan` dan `/admin/master/misa`, konfigurasi di `src/lib/master.ts`; aksi `addMaster`, `updateMaster`, `toggleMaster`, `hapusMaster` di `src/app/admin/master-actions.ts`. Peran: Admin dan Admin Keuangan.
- Halaman master memilih kolom secara eksplisit sehingga `pin_hash` tidak pernah ikut dibaca.

---

## 7. 🔐 Keamanan dan PIN

### 7.1 Masuk PWA dengan PIN

```
/masuk   pilih lingkungan + PIN 6 angka   → check_pin
            berhasil → cookie sesi → beranda
            bila pin_wajib_ganti = true → semua halaman/aksi diarahkan ke /pin

/pin     "Reset PIN" (PIN masih bawaan) atau "Ganti PIN" — formulir sama:
            PIN lama 1x + PIN baru 2x  → change_pin
            berhasil → pin_wajib_ganti = false, pin_version + 1, cookie diperbarui
```

**PIN awal 123456 untuk semua lingkungan**, termasuk lingkungan yang ditambahkan Admin kemudian (nilai bawaan kolom `pin_hash` = hash `123456`, `pin_wajib_ganti` = true). Selama `pin_wajib_ganti`, `requirePwa()` mengalihkan semua halaman dan aksi ke `/pin`; hanya `/pin` (`allowGanti`) yang boleh diakses. Judul halaman dan tombol: **Reset PIN** selama masih bawaan, **Ganti PIN** sesudahnya.

**Kode hasil fungsi PIN** (integer): `> 0` berhasil (= versi PIN) · `-1` salah · `-2` terkunci · `-5` lingkungan tidak ada/nonaktif. Fungsi sengaja **mengembalikan kode, bukan `raise`**, agar penambahan hitungan gagal tetap tersimpan (raise akan membatalkan transaksinya).

| Fungsi | Perilaku |
|---|---|
| `check_pin(l, pin)` | Bandingkan `crypt(pin, pin_hash)`. Benar → `gagal = 0`, kembalikan `pin_version`. Salah → `gagal + 1`; pada kegagalan ke-5: kunci 15 menit dan reset hitungan |
| `change_pin(l, lama, baru)` | Validasi PIN baru (6 angka, bukan 123456); verifikasi PIN lama lewat `check_pin`; simpan hash baru, `pin_wajib_ganti = false`, `pin_version + 1` |
| `bo_reset_pin(l, user)` | Pengguna harus ada di `bo_user`. `pin_hash` = hash `123456`, `pin_wajib_ganti = true`, `pin_version + 1`, hapus kunci dan hitungan gagal |

Admin **tidak pernah melihat atau menentukan** PIN yang dipilih lingkungan. Reset hanya mengembalikan ke 123456.

### 7.2 Sesi masuk

- Cookie `kolekte_pwa` (`httpOnly`, `sameSite=lax`, `secure` di produksi, 14 hari) berisi `{id lingkungan, pin_version, kedaluwarsa}` yang ditandatangani HMAC-SHA256 (`src/lib/pwa-auth.ts`).
- Kunci tanda tangan: `PWA_SESSION_SECRET` bila diisi; bila tidak, diturunkan dari `SUPABASE_SERVICE_ROLE_KEY` (hanya di server). Tidak perlu environment variable baru.
- **Di setiap permintaan** server memverifikasi tanda tangan, masa berlaku, lalu membandingkan `pin_version` di cookie dengan database dan memastikan lingkungan masih aktif. Karena itu **mengganti atau mereset PIN langsung mengeluarkan semua perangkat**.

### 7.3 Isolasi lingkungan

| Lapisan | Aturan |
|---|---|
| Halaman (`/`, `/s/*`, `/review*`, `/hasil`, `/pin`) | `requirePwa()`; tanpa sesi valid → `/masuk`; selama PIN masih bawaan → `/pin`. Halaman sesi/bagian: `404` bila `lingkungan_id` bukan milik login |
| Daftar review dan hasil | Difilter `lingkungan_id = lingkungan login` |
| `startSession` | `lingkungan` selalu dari login, bukan dari form |
| `saveSection` | Sesi harus milik lingkungan login (`BUKAN_MILIK`) |
| `approveSections`, `reviewEdit` | Semua bagian yang disentuh harus milik lingkungan login |

Server Action adalah endpoint yang bisa dipanggil langsung, sehingga **pengecekan ada di setiap aksi**, bukan hanya di halaman.

### 7.3b Aspek lain

| Aspek | Logika |
|---|---|
| Akses data | Semua tabel RLS aktif tanpa policy. Hanya service role (server) yang membaca/menulis. |
| Fungsi SQL | `revoke … from public, anon, authenticated`; `grant execute` hanya ke `service_role`. |
| Kunci rahasia | `SUPABASE_SERVICE_ROLE_KEY` hanya di server (tanpa awalan `NEXT_PUBLIC_`). |
| Auth BO | Supabase Auth (email + password). Setelah login pengguna harus ada di `bo_user`. Middleware menyegarkan token. |
| Peran BO | Hanya `ADMIN_KEUANGAN` lolos `bo_approve`/`bo_return` (dicek di SQL). Reset PIN dan master data boleh Admin dan Admin Keuangan. |
| Batas PIN | 6 angka = 1 juta kemungkinan; penguncian 5 kali/15 menit membatasi penebakan, tetapi pihak lain juga bisa mengunci lingkungan dengan sengaja (reset Admin membukanya). |
| Jejak | `section_review` (APPROVE, EDIT dengan nama) dan `session_review`. Audit log umum, termasuk log masuk/reset PIN: belum. |

---

## 8. 📴 Offline (Rencana, belum dibangun)

| Aspek | Rencana |
|---|---|
| Penyimpanan | IndexedDB (Dexie): draft per `(session_id, tipe)`. |
| Draft | Ditulis lokal dengan debounce; dikirim saat online sebagai snapshot penuh. |
| Submit, edit, approve | Tidak boleh offline (butuh keputusan server). |
| Konflik | Last-write-wins selama masih DRAFT. |

Saat ini PWA hanya punya `manifest.webmanifest` dan ikon; belum ada service worker.

---

## 9. ⚠️ Kasus Tepi

| # | Kasus | Penanganan |
|---|---|---|
| 9.1 | Dua orang dari lingkungan yang sama membuka sesi yang sama | Satu sesi (unik); tiap orang mengisi kantong berbeda. |
| 9.2 | Dua perangkat menyimpan draft kantong yang sama | Last-write-wins (snapshot terakhir). |
| 9.3 | Pereview sama dengan pembuat | Diizinkan. |
| 9.4 | Pereview membuka misa yang sebagian kantongnya belum submit | Daftar menampilkan yang Submitted untuk dicentang; sisanya (termasuk yang belum diisi) di kotak "Belum bisa direview / sudah selesai". |
| 9.5 | Pembuat men-submit bagian baru saat pereview melihat daftar | Bagian baru tidak ada di checklist-nya; approve hanya memproses id yang dikirim. Bila status sebuah bagian berubah, `approve_sections` gagal `SECTION_NOT_SUBMITTED` dan pereview memuat ulang. |
| 9.6 | Pereview mengedit, pembuat tidak tahu | Keputusan: hanya terlihat di Back Office. |
| 9.7 | Salah isi setelah Approved | Hanya lewat Return oleh Admin Keuangan. |
| 9.8 | Sesi Closed ternyata salah | Di luar alur; menunggu keputusan Q5. |
| 9.9 | Parkir/Intensi bernilai 0 | Wajib di-submit dengan "Kosong", lalu di-approve. |
| 9.10 | Zona waktu | Tanggal memakai Asia/Jakarta; `timestamptz` disimpan UTC. |
| 9.11 | Lingkungan yang sama bertugas di Sabtu Sore dan Minggu 1 pada perayaan yang sama | Sesi terpisah per kategori dan tanggal; masing-masing punya empat kantong sendiri. |
| 9.12 | Misa atau lingkungan dinonaktifkan setelah dipakai | Sesi lama tetap tampil; tidak muncul lagi di pilihan baru. Lingkungan nonaktif tidak bisa masuk dan sesinya batal. |
| 9.13 | Admin menghapus lingkungan/misa yang sudah dipakai | Ditolak foreign key; pesan menyarankan menonaktifkan. |
| 9.14 | Jumat Pertama bulan baru | Admin menambah baris master baru, mis. "Jumat Pertama bulan Desember", jenis Jumat Pertama. |
| 9.15 | Lingkungan lupa PIN | Admin mereset di `/admin/pin`: PIN kembali 123456 dan lingkungan wajib Reset PIN lagi saat masuk. |
| 9.16 | PIN bawaan 123456 diketahui umum | Siapa pun yang tahu dapat masuk sebagai lingkungan yang belum melakukan Reset PIN dan melakukannya lebih dulu. Mitigasi: lakukan Reset PIN segera di awal dan setiap selesai reset Admin; Admin dapat mereset ulang bila dicurigai. |
| 9.17 | Penyerang menebak PIN | Setelah 5 kali salah lingkungan terkunci 15 menit; terkunci juga berarti pengguna sah ikut tertahan sampai waktu habis atau Admin mereset. |
| 9.18 | PIN diganti saat ada perangkat lain masuk | `pin_version` naik, perangkat lain diminta masuk lagi. |
| 9.19 | Mengubah daftar pecahan | Ubah konstanta di kode **dan** fungsi `valid_nilai` di SQL. |

---

## 10. 📊 Laporan (Rencana, query acuan)

Rekap per pecahan lintas sesi `CLOSED`, **dipisah per kantong**:

```sql
select s.tipe, l.nilai, sum(l.qty) as total_lembar, sum(l.nilai_baris) as total_rupiah
from section_line l
join section s          on s.id = l.section_id
join kolekte_session ks on ks.id = s.session_id
where ks.status = 'CLOSED' and ks.tanggal between :dari and :sampai
group by s.tipe, l.nilai
order by s.tipe, l.nilai desc;
```

Rekap per misa, lingkungan, dan kantong (Back Office, lintas lingkungan):

```sql
select m.nama as misa, ks.kategori, li.nama as lingkungan, s.tipe, sum(l.nilai_baris) as total
from section_line l
join section s          on s.id = l.section_id
join kolekte_session ks on ks.id = s.session_id
join misa m             on m.id = ks.misa_id
join lingkungan li      on li.id = ks.lingkungan_id
where ks.status = 'CLOSED' and ks.tanggal between :dari and :sampai
group by m.nama, ks.kategori, li.nama, s.tipe;
```

Uji konsistensi: Σ(nilai × total_lembar) harus sama dengan Σ total_rupiah. Laporan resmi hanya memuat sesi `CLOSED`. Laporan di PWA selalu dibatasi ke satu lingkungan.

---

## 11. 🧪 Skenario Uji Logika

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| T-01 | Satu baris tiap 11 pecahan, qty 1 | Subtotal **263.800** |
| T-02 | Contoh Bagian 2 | **926.000** |
| T-03 | qty -1, 1,5, "abc", 1.000.001 | `QTY_INVALID` |
| T-04 | `nilai` 3000 atau 0 | `DENOM_INVALID` |
| T-05 | `open_session` dengan lingkungan yang tidak ada/nonaktif | `LINGKUNGAN_INVALID` |
| T-06 | Submit tanpa baris dan tanpa "Kosong" | `SECTION_EMPTY` |
| T-07 | Misa berjenis Minggu tanpa kategori | `KATEGORI_INVALID` |
| T-08 | Misa berjenis Jumat Pertama dengan kategori terkirim | Sesi tersimpan dengan `kategori` null |
| T-09 | Buka sesi yang sama dua kali | Satu sesi, tidak error |
| T-10 | Pereview mengetik nama yang sama dengan pembuat | Berhasil (diizinkan) |
| T-11 | Approve 3 bagian, salah satunya sudah berubah status | Tidak ada yang ter-approve (atomik) |
| T-12 | Pereview mengedit lalu approve | Ada baris `section_review` EDIT lalu APPROVE; total sesi mengikuti hasil edit |
| T-13 | Merah, Kuning, Parkir Approved; Intensi belum dibuat | Sesi tetap IN_PROGRESS |
| T-14 | Keempat bagian Approved (Parkir/Intensi "Kosong") | Sesi READY_FOR_REVIEW |
| T-15 | Admin biasa memanggil `bo_approve` | `FORBIDDEN` |
| T-16 | Edit baris setelah Submit oleh pembuat | `SECTION_LOCKED` |
| T-17 | Return Kuning → isi ulang → submit → approve | Sesi kembali READY_FOR_REVIEW; kantong lain tidak perlu review ulang |
| T-18 | Nonaktifkan misa/lingkungan yang sudah dipakai | Sesi lama tetap tampil; pilihan baru tanpa itu |
| T-19 | Memanggil fungsi SQL dengan anon key | Ditolak (tidak ada hak execute) |
| T-20 | Tulis ke sesi CLOSED | `SESSION_CLOSED` |
| T-21 | Lingkungan yang sama membuka Minggu 1 dan Minggu 2 pada tanggal dan misa yang sama | Dua sesi terpisah |
| T-22 | Buka Jumat Pertama dua kali (lingkungan dan tanggal sama) | Satu sesi |
| T-23 | `kategori` di luar 3 nilai tetap, langsung ke tabel | Ditolak constraint |
| T-30 | Buka halaman PWA tanpa masuk, atau dengan cookie palsu | Redirect ke `/masuk` |
| T-31 | Lingkungan baru/belum Reset PIN masuk dengan 123456 | Masuk, lalu semua halaman dan aksi PWA diarahkan ke `/pin` berjudul "Reset PIN" |
| T-32 | PIN baru dan pengulangan berbeda | `PIN_MISMATCH`, PIN tidak berubah |
| T-33 | PIN bukan 6 angka (5 digit, huruf) | Ditolak (`PIN_INVALID`) |
| T-34 | Salah PIN 5 kali berturut-turut | Percobaan ke-5 → `PIN_LOCKED`; PIN benar pun ditolak selama 15 menit |
| T-35 | PIN benar setelah beberapa kali salah (<5) | Masuk; hitungan gagal kembali 0 |
| T-36 | Ganti PIN dengan PIN lama salah | Ditolak, ikut hitungan gagal |
| T-37 | Admin mereset PIN | PIN kembali 123456, perangkat yang sedang masuk keluar, lingkungan wajib Reset PIN lagi |
| T-38 | PIN baru `123456` atau bukan 6 angka | `PIN_DEFAULT` / `PIN_INVALID`, PIN tidak berubah |
| T-39 | Lingkungan A memanggil `saveSection` dengan id sesi lingkungan B | `BUKAN_MILIK`, tidak ada perubahan |
| T-40 | Lingkungan A mengirim `approveSections` berisi id bagian lingkungan B | `BUKAN_MILIK`, tidak ada yang ter-approve |
| T-41 | Lingkungan A membuka `/s/{id sesi B}` | 404 |
| T-42 | `/hasil` dan `/review` untuk lingkungan A | Hanya data A |
| T-43 | Hapus lingkungan yang belum dipakai / yang sudah dipakai | Berhasil / `MASTER_DIPAKAI` |
| T-44 | Menambah lingkungan baru lewat master | Muncul di pilihan `/masuk`; masuk dengan 123456 lalu wajib Reset PIN |
| T-45 | Setelah Reset PIN pertama berhasil | Judul/tombol menjadi "Ganti PIN", halaman lain bisa dipakai; Ganti PIN meminta PIN lama 1× dan PIN baru 2× |

Semua skenario di atas **belum dijalankan** terhadap database sungguhan.

---

## 12. ❓ Menunggu Keputusan

| Ref | Pertanyaan | Dampak |
|---|---|---|
| Q4 | Intensi menyimpan nama/tujuan? | Kolom tambahan |
| Q5 | Batas waktu koreksi setelah CLOSED | Kasus 9.8 |
| Q12 | Dua misa di hari yang sama dipisah per misa | Konfirmasi |

**Sudah diputuskan:** Parkir/Intensi wajib; PWA masuk dengan lingkungan + PIN 6 angka (awal 123456, wajib di-Reset sekali, lalu bisa diganti; Admin dapat mereset ke 123456); isian, review, dan hasil PWA hanya untuk lingkungan sendiri; notifikasi edit hanya di Back Office; pembuat dan pereview boleh sama; pecahan dan jenis kantong adalah konstanta; master data: Lingkungan (CRUD) dan Misa.
