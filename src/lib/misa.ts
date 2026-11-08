import "server-only";
import { db } from "./admin";

// Daftar misa: yang paling baru ditambahkan di paling atas (tanpa urutan manual).
// Memakai select("*") dan mengurutkan di aplikasi, sehingga tetap berfungsi (urut nama) sebelum
// migrasi 005 (kolom created_at) dijalankan di database.
export function urutMisa<T extends { nama: string; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const t = (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0);
    return t !== 0 ? t : a.nama.localeCompare(b.nama);
  });
}

export async function ambilMisa(opts?: { aktif?: boolean }) {
  let q = db.from("misa").select("*");
  if (opts?.aktif) q = q.eq("aktif", true);
  const { data } = await q;
  return urutMisa((data ?? []) as any[]);
}
