import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./admin";

// Masuk PWA: pilih lingkungan + PIN 6 angka. Sesi = cookie bertanda tangan (HMAC) berisi id lingkungan,
// versi PIN, dan masa berlaku. Versi PIN diperiksa ke database di tiap permintaan, jadi mengganti atau
// mereset PIN langsung membatalkan semua sesi lama.

const COOKIE = "kolekte_pwa";
const MAX_AGE = 14 * 24 * 60 * 60; // 14 hari

// Kunci tanda tangan: PWA_SESSION_SECRET bila diisi; bila tidak, diturunkan dari service role key (hanya di server).
const secret = () => process.env.PWA_SESSION_SECRET || `pwa-session:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev"}`;
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export type PwaSession = { id: string; nama: string; wajibGanti: boolean };

export async function startPwaSession(lingkunganId: string, version: number) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ l: lingkunganId, v: version, e: exp })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endPwaSession() {
  (await cookies()).delete(COOKIE);
}

export async function getPwaSession(): Promise<PwaSession | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;

  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let data: { l?: string; v?: number; e?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data.l || typeof data.v !== "number" || typeof data.e !== "number" || data.e < Date.now() / 1000) return null;

  const { data: row } = await db
    .from("lingkungan").select("id,nama,aktif,pin_version,pin_wajib_ganti").eq("id", data.l).maybeSingle();
  if (!row || !row.aktif || row.pin_version !== data.v) return null;
  return { id: row.id, nama: row.nama, wajibGanti: row.pin_wajib_ganti };
}

// Selama PIN masih bawaan (123456), semua halaman dan aksi mengarah ke /pin (Reset PIN) sampai PIN diganti.
export async function requirePwa(opts?: { allowGanti?: boolean }): Promise<PwaSession> {
  const s = await getPwaSession();
  if (!s) redirect("/masuk");
  if (s.wajibGanti && !opts?.allowGanti) redirect("/pin");
  return s;
}
