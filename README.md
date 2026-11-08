# Kolekte (versi minimal)

Next.js 15 + Supabase. Spesifikasi: [docs/PRD_Sistem_Kolekte.md](docs/PRD_Sistem_Kolekte.md) dan [docs/Technical_Logic_Sistem_Kolekte.md](docs/Technical_Logic_Sistem_Kolekte.md).

## Setup

1. Buat project di Supabase. Buka **SQL Editor** dan jalankan berurutan, masing-masing sekali (**Run**):
   1. `supabase/migrations/001_init.sql`
   2. `supabase/migrations/002_jumat_pertama_pilihan.sql`
   3. `supabase/migrations/003_lingkungan_master_pin.sql`

   Bila sebagian sudah pernah dijalankan, lanjutkan dari yang belum. Data uji yang ada dipertahankan.
2. Buat user Back Office: seeder `npm run seed:admin -- email@contoh.com ADMIN_KEUANGAN` (butuh `.env.local`), atau **Authentication → Users → Add user** lalu:
   ```sql
   insert into bo_user (user_id, role)
   select id, 'ADMIN_KEUANGAN' from auth.users where email = 'email-anda@contoh.com';
   ```
   (`role` bisa `ADMIN` atau `ADMIN_KEUANGAN`. Keduanya mengelola master data dan mereset PIN; hanya Admin Keuangan yang bisa approve/return sesi.)
3. Salin `.env.example` menjadi `.env.local`, isi dari Supabase **Project Settings → API**.
4. `npm install` lalu `npm run dev`.

**Data awal:** 9 lingkungan/wilayah (7 lingkungan + OMK + WKRI) dan 4 contoh misa. Keduanya bisa diubah di Back Office → Master Data (tambah, ubah, nonaktifkan, hapus bila belum dipakai). Pecahan (11) dan jenis kantong (Merah, Kuning, Parkir, Intensi) adalah konstanta di kode dan SQL. Sabtu Sore / Minggu 1 / Minggu 2 juga konstanta, dipilih untuk misa berjenis Minggu.

## Masuk PWA dengan PIN

1. Di `/masuk`, pilih **lingkungan/wilayah** dan masukkan PIN 6 angka. **PIN awal semua lingkungan: `123456`.**
2. Saat pertama masuk, lingkungan **wajib menekan "Reset PIN" sekali**: isi **PIN lama 1x** (123456) dan **PIN baru 2x** (diulang). PIN baru harus 6 angka dan bukan 123456.
3. Sesudah itu tombolnya menjadi **"Ganti PIN"** dengan isian yang sama (PIN lama 1x, PIN baru 2x).
4. Lupa PIN: **Admin mereset** di Back Office → PIN Lingkungan. PIN kembali ke 123456 dan lingkungan wajib Reset PIN lagi saat masuk.
5. Lima kali salah PIN mengunci lingkungan itu 15 menit.

Setelah masuk, isian, review, dan hasil di PWA **hanya untuk lingkungan itu sendiri**. Lintas lingkungan ada di Back Office.

## Alamat

| Alamat | Fungsi |
|---|---|
| `/masuk` | Masuk PWA: pilih lingkungan + PIN 6 angka (awal 123456) |
| `/` | Pembuat, langkah 1: Nama → Tanggal → Misa → Sabtu Sore/Minggu 1/Minggu 2 (kecuali Jumat Pertama). Lingkungan dari login |
| `/s/{id}` dan `/s/{id}/{tipe}` | Langkah 2–3: pilih satu kantong (Merah/Kuning/Parkir/Intensi), isi qty per pecahan, Submit. Keempat kantong wajib |
| `/review` | Pereview (boleh orang yang sama dengan pembuat): pilih misa hari itu → nama → daftar → centang semua → Approve |
| `/review/edit/{sectionId}` | Pereview mengedit isian dulu sebelum Approve |
| `/hasil` | Hasil akhir per misa (baca saja, lingkungan sendiri): total per kantong, rekap per pecahan dipisah per kantong |
| `/pin` | Reset PIN (wajib sekali dari PIN bawaan), lalu Ganti PIN: PIN lama 1x, PIN baru 2x |
| `/admin`, `/admin/{id}` | Back Office: daftar sesi (lintas lingkungan), detail, review total (Admin Keuangan) |
| `/admin/master/lingkungan`, `/admin/master/misa` | Master data Lingkungan dan Misa (CRUD) |
| `/admin/pin` | Reset PIN lingkungan ke 123456 |

## Tampilan

- **Logo paroki** (`docs/logo.png`) tampil di header PWA, halaman masuk, login Back Office, dan sidebar. Versi ringan dan ikon aplikasi ada di `public/` (`logo.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`). Untuk mengganti logo, ganti `docs/logo.png` lalu jalankan `python scripts/make-logos.py .` (butuh Pillow).
- **Warna:** hijau tua (`--accent-dark`) untuk header PWA dan sidebar, hijau (`--accent`) untuk tombol dan tautan. Diatur di `src/app/globals.css`.
- **Back Office memakai sidebar** sebagai satu-satunya navigasi: Sesi Kolekte, Lingkungan / Wilayah, Misa, PIN Lingkungan, dan Keluar. Di HP sidebar menjadi bilah atas.

## Yang sengaja belum ada

Service worker dan draft offline, audit log umum (jejak review ada di `section_review` dan `session_review`), laporan/export, layar kelola pengguna Back Office. Pembuat tidak diberi notifikasi bila bagiannya diedit pereview.

## Catatan penting

Kode sudah lolos typecheck dan build, tetapi **belum pernah dijalankan terhadap Supabase sungguhan**. Uji alur masuk PIN dan kedua journey end-to-end setelah migrasi dijalankan.
