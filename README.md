# Kolekte (versi minimal)

Next.js 15 + Supabase. Spesifikasi: [docs/PRD_Sistem_Kolekte.md](docs/PRD_Sistem_Kolekte.md) dan [docs/Technical_Logic_Sistem_Kolekte.md](docs/Technical_Logic_Sistem_Kolekte.md).

## Setup

1. Buat project di Supabase. Buka **SQL Editor**, jalankan berurutan, masing-masing **Run**: isi `supabase/migrations/001_init.sql`, lalu isi `supabase/migrations/002_jumat_pertama_pilihan.sql`.
   (Bila `001` sudah pernah dijalankan, cukup jalankan `002`; sesi lama dipertahankan di misa penampung "Misa Lama (data uji)".)
2. Buat user Back Office: **Authentication → Users → Add user**, lalu jalankan di SQL Editor:
   ```sql
   insert into bo_user (user_id, role)
   select id, 'ADMIN_KEUANGAN' from auth.users where email = 'email-anda@contoh.com';
   ```
   (`role` bisa `ADMIN` atau `ADMIN_KEUANGAN`. Keduanya mengelola master Misa; hanya Admin Keuangan yang bisa approve/return sesi.)
3. Salin `.env.example` menjadi `.env.local`, isi dari Supabase **Project Settings → API**.
4. `npm install` lalu `npm run dev`.

Seed otomatis: contoh master Misa (Minggu Kerahiman Ilahi, Minggu Biasa XXI, Minggu Advent 1, Jumat Pertama bulan November); ubah di menu Master Misa. **Sabtu Sore / Minggu 1 / Minggu 2 bukan master**, melainkan pilihan tetap untuk misa berjenis Minggu. Pecahan (11), lingkungan (7), dan jenis kantong (Merah, Kuning, Parkir, Intensi) adalah konstanta di kode dan SQL, bukan master data.

## Alamat

| Alamat | Fungsi |
|---|---|
| `/` | Pembuat (tanpa login), langkah 1: Nama → Tanggal → Misa → Sabtu Sore/Minggu 1/Minggu 2 (kecuali Jumat Pertama) → Lingkungan |
| `/s/{id}` dan `/s/{id}/{tipe}` | Langkah 2–3: pilih satu kantong (Merah/Kuning/Parkir/Intensi), isi qty per pecahan, Submit. Keempat kantong wajib |
| `/review` | Pereview (tanpa login; boleh orang yang sama dengan pembuat): pilih misa hari itu → nama → daftar → centang semua → Approve |
| `/review/edit/{sectionId}` | Pereview mengedit isian dulu sebelum Approve |
| `/hasil` | Hasil akhir per misa (baca saja): total per lingkungan dan kantong, rekap per pecahan yang dipisah per kantong |
| `/admin` dan `/admin/{id}` | Back Office: daftar sesi, detail, review total (Admin Keuangan) |
| `/admin/master/misa` | Master data Misa |

## Yang sengaja belum ada

Service worker dan draft offline, audit log umum (jejak review ada di `section_review` dan `session_review`), laporan/export, layar kelola pengguna Back Office. (PWA sengaja tanpa PIN, dan pembuat tidak diberi notifikasi bila bagiannya diedit pereview.)

## Catatan penting

Kode sudah lolos typecheck dan build, tetapi **belum pernah dijalankan terhadap Supabase sungguhan**. Uji kedua journey end-to-end setelah migrasi dijalankan.
