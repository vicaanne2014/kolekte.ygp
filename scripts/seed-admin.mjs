// Seeder akun Back Office: membuat user di Supabase Auth lalu mendaftarkannya ke tabel bo_user.
//
// Pakai (dari folder proyek, dengan .env.local berisi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY):
//   npm run seed:admin -- email@contoh.com ADMIN_KEUANGAN
//
// Opsi (argumen atau environment):
//   argumen 1 / SEED_EMAIL     email login   (default: admin@kolekte.local)
//   argumen 2 / SEED_ROLE      ADMIN_KEUANGAN | ADMIN   (default: ADMIN_KEUANGAN)
//   SEED_PASSWORD              password; bila kosong dibuat acak dan ditampilkan SEKALI
//
// Aman dijalankan berulang: user yang sudah ada tidak dibuat ganda; peran diperbarui;
// password hanya diubah bila SEED_PASSWORD diisi.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const fail = (msg) => {
  console.error("Gagal: " + msg);
  process.exit(1);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  fail("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum terisi. Isi di .env.local (lihat .env.example).");
}

const email = (process.argv[2] || process.env.SEED_EMAIL || "admin@kolekte.local").trim().toLowerCase();
const role = (process.argv[3] || process.env.SEED_ROLE || "ADMIN_KEUANGAN").trim().toUpperCase();
if (!["ADMIN", "ADMIN_KEUANGAN"].includes(role)) fail("Peran harus ADMIN atau ADMIN_KEUANGAN.");

const given = process.env.SEED_PASSWORD;
if (given && given.length < 8) fail("SEED_PASSWORD minimal 8 karakter.");
const password = given || randomBytes(12).toString("base64url"); // 16 karakter

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
let passwordSet = false;

const created = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (!created.error) {
  userId = created.data.user.id;
  passwordSet = true;
} else if (/already|registered|exists/i.test(created.error.message)) {
  for (let page = 1; !userId; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail("Tidak bisa membaca daftar user: " + error.message);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) fail("User sudah ada tetapi tidak ditemukan di daftar.");
  if (given) {
    const { error } = await sb.auth.admin.updateUserById(userId, { password: given, email_confirm: true });
    if (error) fail("Tidak bisa mengubah password: " + error.message);
    passwordSet = true;
  }
} else {
  fail("Tidak bisa membuat user: " + created.error.message);
}

const { error: boErr } = await sb.from("bo_user").upsert({ user_id: userId, role }, { onConflict: "user_id" });
if (boErr) {
  fail(`User auth sudah ada, tetapi gagal mendaftarkan ke bo_user: ${boErr.message}\n` +
       "Pastikan supabase/migrations/001_init.sql sudah dijalankan.");
}

console.log("\nAkun Back Office siap.");
console.log("  Email   : " + email);
console.log("  Peran   : " + role);
if (passwordSet) {
  console.log("  Password: " + password + (given ? "  (sesuai SEED_PASSWORD)" : "  (acak, hanya ditampilkan sekali; simpan sekarang)"));
} else {
  console.log("  Password: tidak diubah (user sudah ada)");
}
console.log("\nMasuk di /admin/login memakai email di atas.\n");
