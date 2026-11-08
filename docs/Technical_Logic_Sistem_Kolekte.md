# Technical Logic — Sistem Kolekte

| Item | Isi |
|---|---|
| Versi | 0.3 — disesuaikan dengan aplikasi yang sudah dibangun |
| Tanggal | 8 November 2026 |
| Dokumen induk | [PRD_Sistem_Kolekte.md](PRD_Sistem_Kolekte.md) |
| Stack | Next.js 15 (Server Actions) + Supabase (PostgreSQL + Auth) |
| Sumber kebenaran skema dan fungsi | [001_init.sql](../supabase/migrations/001_init.sql) (satu file) |

Dokumen ini menjelaskan **logika teknis**: konstanta, rumus, validasi, perubahan status, fungsi database, dan kasus tepi. DDL lengkap tidak disalin ke sini agar tidak berbeda dengan migrasi.

**Prinsip arsitektur:** seluruh aturan workflow ada di **fungsi SQL** (atomik, satu transaksi). Next.js hanya memanggil fungsi itu lewat service role. Browser tidak punya akses ke tabel (RLS aktif tanpa policy) dan tidak bisa memanggil fungsi (hak `execute` dicabut dari `anon` dan `authenticated`).

---

## 1. 📌 Konstanta dan Master Data

### 1.1 Konstanta (bukan master data)

Didefinisikan di dua tempat yang harus selalu sama: kode (`src/lib/kolekte.ts`) untuk tampilan, dan SQL (`valid_nilai()`, `valid_lingkungan()` di `001_init.sql`) untuk penegakan di database.

**Pecahan (11):** 100000, 75000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100. Rp75.000 adalah uang kertas peringatan. Rp1.000 satu baris (kertas dan koin dijumlahkan).

**Lingkungan (7):** Sta. Felisitas, St. Edmund, St. Hieronimus, St. Fransiscus Xaverius, Sta. Veronica, Sta. Maria Ratu Rosari, Sta. Maria Medali Wasiat.

**Jenis kantong (4):** `RED` (Kantong Merah), `YELLOW` (Kantong Kuning), `PARKIR`, `INTENSI`. Tidak ada kategori di dalam kantong.

Mengubah salah satu daftar ini = ubah kode **dan** fungsi SQL (lalu jalankan ulang fungsinya). Tidak ada layar kelola.

### 1.2 Master data: hanya `misa`

| Kolom | Arti |
|---|---|
| `nama` | Unik. Seed: Sabtu Sore, Minggu 1, Minggu 2, Jumat Pertama |
| `pilih_bulan` | true = pembuat wajib memilih bulan 1–12 (Jumat Pertama) |
| `urutan`, `aktif` | Urutan tampil dan status. Tidak ada hapus, hanya nonaktif |

Dikelola Admin dan Admin Keuangan di `/admin/master/misa`.

---

## 2. 🧮 Rumus Perhitungan

Semua uang adalah **integer rupiah** (`bigint` di database). Tidak ada desimal dan tidak ada pembulatan.

```
nilai_baris        = nilai pecahan × qty
subtotal_section   = Σ nilai_baris        (semua baris section)
grand_total_sesi   = Σ subtotal_section   (RED + YELLOW + PARKIR + INTENSI)
rekap_pecahan      = Σ qty per nilai      (lintas section, untuk mencocokkan uang fisik)
```

Contoh (satu kantong): 2×100.000 + 2×75.000 + 4×50.000 + 10×20.000 + 7×10.000 + 12×5.000 + 5×2.000 + 30×1.000 + 8×500 + 5×200 + 10×100 = **926.000**.

**Sumber kebenaran:** klien hanya menampilkan estimasi. Server (`replace_lines`) menghitung ulang dari `(nilai, qty)` dan menyimpan `nilai_baris` dan `subtotal`. Total dari klien tidak dipakai. `bo_approve` memeriksa ulang bahwa `grand_total` sama dengan jumlah semua `nilai_baris`.

---

## 3. ✅ Aturan Validasi

### 3.1 Sesi (`open_session`)

| Kode | Aturan | Error |
|---|---|---|
| V-01 | Nama 2–60 karakter | `NAMA_INVALID` |
| V-02 | Tanggal terisi dan tidak lebih dari besok (zona Asia/Jakarta) | `TANGGAL_INVALID` |
| V-03 | Lingkungan salah satu dari 7 nilai tetap | `LINGKUNGAN_INVALID` |
| V-04 | Misa ada dan aktif | `MISA_INVALID` |
| V-05 | Bila `misa.pilih_bulan`, `bulan` wajib 1–12. Bila tidak, `bulan` diabaikan (disimpan null) | `BULAN_INVALID` |
| V-06 | Unik `(lingkungan, tanggal, misa_id)`. Bila sudah ada, sesi yang ada dikembalikan (idempoten, bukan error) | — |

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

**Tidak ada aturan "nama pembuat ≠ nama pereview".** Pembuat dan pereview boleh orang yang sama; keduanya tetap wajib mengetik nama dan dicatat.

### 3.4 Review total (BO)

| Kode | Aturan | Error |
|---|---|---|
| V-30 | Pengguna ada di `bo_user` dengan peran `ADMIN_KEUANGAN` | `FORBIDDEN` |
| V-31 | Sesi `READY_FOR_REVIEW` dan `is_ready` benar | `NOT_READY` |
| V-32 | Approve: total tersimpan = jumlah baris | `TOTAL_MISMATCH` |
| V-33 | Return: ≥ 1 bagian `APPROVED` dipilih, catatan ≥ 3 karakter | `SECTIONS_REQUIRED`, `NOTE_REQUIRED` |

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

Parkir dan Intensi **wajib**. Bila nilainya 0, bagian tetap dibuat lalu di-submit dengan `is_empty = true`, dan tetap harus di-approve. Karena `unique (session_id, tipe)`, empat bagian berarti tepat satu baris per jenis kantong.

---

## 5. 🗄️ Skema Ringkas

Tabel: `misa`, `kolekte_session`, `section`, `section_line`, `section_review`, `session_review`, `bo_user`.

| Tabel | Poin penting |
|---|---|
| `kolekte_session` | `lingkungan` (text, dibatasi `valid_lingkungan`), `tanggal`, `misa_id`, `bulan` (1–12, nullable), `status`, `grand_total`, `created_by_name`. Unik `(lingkungan, tanggal, misa_id)`. |
| `section` | Unik `(session_id, tipe)`. Status `DRAFT`/`SUBMITTED`/`APPROVED`. `created_by_name` diisi/ditimpa saat Submit. `note` untuk catatan Return. |
| `section_line` | Unik `(section_id, nilai)`. `nilai` dibatasi `valid_nilai`. Menyimpan `qty` dan `nilai_baris`. |
| `section_review` | `aksi` ∈ APPROVE, **EDIT**. EDIT menyimpan `note` "Subtotal lama -> baru". |
| `session_review` | `aksi` ∈ APPROVE, RETURN; menyimpan `grand_total` saat review dan bagian yang dibuka ulang. |
| `bo_user` | `user_id` (Supabase Auth) + `role` ∈ ADMIN, ADMIN_KEUANGAN. |

Seed: 4 misa. Tidak ada seed lain (pecahan dan lingkungan adalah konstanta).

---

## 6. ⚙️ Fungsi dan Algoritma

Setiap fungsi berjalan dalam satu transaksi dan mengunci baris yang disentuh (`for update`).

| Halaman / aksi | Server Action | Fungsi SQL |
|---|---|---|
| `/` mulai sesi | `startSession` | `open_session` |
| `/s/{id}/{tipe}` simpan | `saveSection` (intent save) | `save_section` |
| `/s/{id}/{tipe}` submit | `saveSection` (intent submit) | `save_section` lalu `submit_section` |
| `/review` approve | `approveSections` | `approve_sections` |
| `/review/edit/{id}` simpan | `reviewEdit` | `review_edit_section` |
| `/hasil` lihat | (tidak ada, baca saja) | — |
| `/admin/{id}` approve | `approveSession` | `bo_approve` |
| `/admin/{id}` return | `returnSession` | `bo_return` |

### 6.1 Alur pengisian PWA (pembuat)

1. **Data diri dan misa:** Nama, Tanggal, Misa (+ Bulan bila Jumat Pertama), Lingkungan → `open_session`.
2. **Pilih satu kantong** di halaman sesi, lalu **masukkan qty per pecahan** (11 baris).
3. **Submit.**

Setiap petugas memilih satu kantong, sehingga per misa per lingkungan ada 4 isian (4 `section`), masing-masing di-submit sendiri-sendiri oleh orang yang mengisinya.

### 6.2 `open_session(lingkungan, tanggal, misa, bulan, nama)`

```
1. validasi V-01…V-05
2. insert … on conflict (lingkungan, tanggal, misa_id) do nothing
3. return id sesi (baru atau yang sudah ada)
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

Edit hanya mencatat subtotal sebelum dan sesudah, bukan selisih per baris. Pembuat tidak diberi notifikasi; edit hanya terlihat di Back Office ("Diedit oleh …").

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

Mengurutkan kunci menurut `(session_id, id)` mencegah deadlock bila dua pereview menekan Approve bersamaan.

**Checklist** diterapkan di UI: tombol Approve nonaktif sampai semua bagian dalam daftar dicentang. Server hanya memvalidasi id yang dikirim.

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

Bagian yang tidak dipilih tetap APPROVED dan tidak perlu direview ulang.

### 6.9 Hasil akhir per misa (PWA, baca saja)

Halaman `/hasil` (GET: `tanggal`, `misa`) tanpa login dan tanpa aksi tulis. Membaca sesi pada `(tanggal, misa_id)` beserta bagian dan baris, lalu menampilkan:

- Tabel 7 lingkungan × (Merah, Kuning, Parkir, Intensi, Total, Status); lingkungan tanpa sesi tampil "Belum ada data".
- Total semua lingkungan, dan berapa yang sudah `CLOSED` (jumlah serta nilainya).
- Rekap per pecahan: Σ qty dan nilai lintas semua bagian.

Angka berasal dari `grand_total`/`subtotal` tersimpan (yang dihitung server). Sesi yang belum Closed ikut tampil dengan statusnya; hanya yang Closed dihitung sebagai "sudah final". Finalisasi tetap `bo_approve` oleh Admin Keuangan.

### 6.10 Master data Misa (Back Office)

- Halaman `/admin/master/misa`, konfigurasi di `src/lib/master.ts`; aksi `addMaster`, `updateMaster`, `toggleMaster` di `src/app/admin/master-actions.ts`.
- Peran: Admin dan Admin Keuangan.
- Tidak ada hapus, hanya `aktif = false`. Misa nonaktif tidak muncul di pilihan baru, tetapi sesi lama tetap tampil.

---

## 7. 🔐 Keamanan

| Aspek | Logika |
|---|---|
| Akses data | Semua tabel RLS aktif tanpa policy. Hanya service role (server) yang membaca/menulis. |
| Fungsi SQL | `revoke … from public, anon, authenticated`; `grant execute` hanya ke `service_role`. |
| Kunci rahasia | `SUPABASE_SERVICE_ROLE_KEY` hanya di server (tanpa awalan `NEXT_PUBLIC_`). |
| Auth BO | Supabase Auth (email + password). Setelah login, pengguna harus ada di `bo_user`; bila tidak, sesi login dibatalkan. Middleware menyegarkan token. |
| Peran BO | Hanya `ADMIN_KEUANGAN` lolos `bo_approve`/`bo_return` (dicek di fungsi SQL, bukan hanya di UI). |
| PWA | `/hasil` hanya membaca. **Tanpa login dan tanpa PIN** (keputusan). Siapa pun yang memegang tautan dapat menulis. Pembuat boleh sama dengan pereview, jadi tidak ada pemisahan tugas di PWA. Kontrol kompensasi ada di Admin Keuangan (melihat nama, rincian per pecahan, dan tanda edit). Rate limit: belum. |
| Jejak | `section_review` (APPROVE, EDIT dengan nama) dan `session_review`. Audit log umum (IP, user agent, before/after per baris): belum. |

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
| 9.1 | Dua orang membuka lingkungan + tanggal + misa yang sama | Satu sesi (unik); tiap orang mengisi kantong berbeda. |
| 9.2 | Dua perangkat menyimpan draft kantong yang sama | Last-write-wins (snapshot terakhir). |
| 9.3 | Pereview sama dengan pembuat | Diizinkan. |
| 9.4 | Pereview membuka misa yang sebagian kantong/lingkungannya belum submit | Daftar menampilkan yang Submitted untuk dicentang; sisanya (termasuk yang belum diisi) di kotak "Belum bisa direview / sudah selesai". |
| 9.5 | Pembuat men-submit bagian baru saat pereview melihat daftar | Bagian baru tidak ada di checklist-nya; approve hanya memproses id yang dikirim. Bila status sebuah bagian berubah (diedit atau disetujui orang lain), `approve_sections` gagal `SECTION_NOT_SUBMITTED` dan pereview memuat ulang. |
| 9.6 | Pereview mengedit, pembuat tidak tahu | Keputusan: hanya terlihat di Back Office. |
| 9.7 | Salah isi setelah Approved | Hanya lewat Return oleh Admin Keuangan (bagian jadi Draft). |
| 9.8 | Sesi Closed ternyata salah | Di luar alur; menunggu keputusan Q5. |
| 9.9 | Parkir/Intensi bernilai 0 | Wajib di-submit dengan "Kosong", lalu di-approve. |
| 9.10 | Zona waktu | Tanggal memakai Asia/Jakarta; `timestamptz` disimpan UTC. |
| 9.11 | Jumat Pertama dengan bulan tidak sama dengan bulan tanggal | Tidak dicek; bulan adalah pilihan pembuat. |
| 9.12 | Misa dinonaktifkan setelah dipakai | Sesi lama tetap tampil; tidak muncul lagi di pilihan baru. |
| 9.13 | Daftar pecahan/lingkungan perlu diubah | Ubah konstanta di kode **dan** fungsi `valid_nilai`/`valid_lingkungan` di SQL. |

---

## 10. 📊 Laporan (Rencana, query acuan)

Rekap per pecahan lintas sesi `CLOSED`:

```sql
select l.nilai, sum(l.qty) as total_lembar, sum(l.nilai_baris) as total_rupiah
from section_line l
join section s          on s.id = l.section_id
join kolekte_session ks on ks.id = s.session_id
where ks.status = 'CLOSED' and ks.tanggal between :dari and :sampai
group by l.nilai
order by l.nilai desc;
```

Rekap per misa, lingkungan, dan kantong:

```sql
select m.nama as misa, ks.bulan, ks.lingkungan, s.tipe, sum(l.nilai_baris) as total
from section_line l
join section s          on s.id = l.section_id
join kolekte_session ks on ks.id = s.session_id
join misa m             on m.id = ks.misa_id
where ks.status = 'CLOSED' and ks.tanggal between :dari and :sampai
group by m.nama, ks.bulan, ks.lingkungan, s.tipe;
```

Uji konsistensi: Σ(nilai × total_lembar) harus sama dengan Σ total_rupiah. Laporan resmi hanya memuat sesi `CLOSED`.

---

## 11. 🧪 Skenario Uji Logika

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| T-01 | Satu baris tiap 11 pecahan, qty 1 | Subtotal **263.800** |
| T-02 | Contoh Bagian 2 | **926.000** |
| T-03 | qty -1, 1,5, "abc", 1.000.001 | `QTY_INVALID` |
| T-04 | `nilai` 3000 atau 0 | `DENOM_INVALID` |
| T-05 | Lingkungan di luar 7 nilai tetap | `LINGKUNGAN_INVALID` |
| T-06 | Submit tanpa baris dan tanpa "Kosong" | `SECTION_EMPTY` |
| T-07 | Pilih Jumat Pertama tanpa bulan | `BULAN_INVALID` |
| T-08 | Pilih Minggu 1 dengan bulan terkirim | Sesi tersimpan dengan `bulan` null |
| T-09 | Buka sesi yang sama dua kali | Satu sesi, tidak error |
| T-10 | Pereview mengetik nama yang sama dengan pembuat | Berhasil (diizinkan) |
| T-11 | Approve 3 bagian, salah satunya sudah berubah status | Tidak ada yang ter-approve (atomik) |
| T-12 | Pereview mengedit lalu approve | Ada baris `section_review` EDIT lalu APPROVE; total sesi mengikuti hasil edit |
| T-13 | Merah, Kuning, Parkir Approved; Intensi belum dibuat | Sesi tetap IN_PROGRESS |
| T-14 | Keempat bagian Approved (Parkir/Intensi "Kosong") | Sesi READY_FOR_REVIEW |
| T-15 | Admin biasa memanggil `bo_approve` | `FORBIDDEN` |
| T-16 | Edit baris setelah Submit oleh pembuat | `SECTION_LOCKED` |
| T-17 | Return Kuning → isi ulang → submit → approve | Sesi kembali READY_FOR_REVIEW; kantong lain tidak perlu review ulang |
| T-18 | Nonaktifkan misa yang sudah dipakai | Sesi lama tetap tampil; pilihan baru tanpa misa itu |
| T-19 | Memanggil fungsi SQL dengan anon key | Ditolak (tidak ada hak execute) |
| T-20 | Tulis ke sesi CLOSED | `SESSION_CLOSED` |

Semua skenario di atas **belum dijalankan** terhadap database sungguhan.

---

## 12. ❓ Menunggu Keputusan

| Ref | Pertanyaan | Dampak |
|---|---|---|
| Q4 | Intensi menyimpan nama/tujuan? | Kolom tambahan |
| Q5 | Batas waktu koreksi setelah CLOSED | Kasus 9.8 |
| Q12 | Dua misa di hari yang sama dipisah per misa | Konfirmasi |

**Sudah diputuskan:** Parkir/Intensi wajib; tanpa PIN PWA; notifikasi edit hanya di Back Office; pembuat dan pereview boleh sama; pecahan, lingkungan, dan kantong adalah konstanta; master data hanya Misa.
