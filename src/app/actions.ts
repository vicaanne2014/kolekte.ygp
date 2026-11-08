"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/admin";
import { authClient, requireBo } from "@/lib/auth";
import { isTipe } from "@/lib/kolekte";
import { endPwaSession, requirePwa, startPwaSession } from "@/lib/pwa-auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function back(path: string, error?: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}e=${encodeURIComponent(error)}` : path);
}

// Kode hasil fungsi PIN di SQL: >0 berhasil (versi PIN); -1 salah; -2 terkunci; -5 lingkungan tidak aktif
const PIN_ERR: Record<number, string> = { [-1]: "PIN_WRONG", [-2]: "PIN_LOCKED", [-5]: "LINGKUNGAN_NONAKTIF" };
const pinErr = (n: number) => PIN_ERR[n] ?? "PIN_WRONG";

// ---------- PWA: masuk dengan lingkungan + PIN 6 angka ----------

export async function masuk(f: FormData) {
  const l = str(f, "lingkungan");
  const path = `/masuk?l=${encodeURIComponent(l)}`;
  const { data, error } = await db.rpc("check_pin", { p_lingkungan: l, p_pin: str(f, "pin") });
  if (error) back(path, "PIN_WRONG");
  const v = Number(data);
  if (!(v > 0)) back(path, pinErr(v));
  await startPwaSession(l, v);
  redirect("/"); // bila PIN masih bawaan, halaman beranda mengarahkan ke /pin (Reset PIN)
}

export async function keluar() {
  await endPwaSession();
  redirect("/masuk");
}

// "Reset PIN" (pertama kali, dari PIN bawaan) dan "Ganti PIN": PIN lama 1x + PIN baru 2x (diulang).
export async function gantiPin(f: FormData) {
  const me = await requirePwa({ allowGanti: true });
  const baru = str(f, "pin_baru");
  if (baru !== str(f, "pin_ulang")) back("/pin", "PIN_MISMATCH");
  const { data, error } = await db.rpc("change_pin", {
    p_lingkungan: me.id, p_old: str(f, "pin_lama"), p_new: baru,
  });
  if (error) back("/pin", error.message);
  const v = Number(data);
  if (!(v > 0)) back("/pin", pinErr(v));
  await startPwaSession(me.id, v);
  redirect(me.wajibGanti ? "/" : "/pin?ok=1");
}

// ---------- Pengecekan kepemilikan (aksi di PWA tidak boleh menyentuh data lingkungan lain) ----------

async function sessionOwnedBy(sessionId: string, lingkunganId: string) {
  const { data } = await db.from("kolekte_session").select("lingkungan_id").eq("id", sessionId).maybeSingle();
  return data?.lingkungan_id === lingkunganId;
}

async function sectionsOwnedBy(ids: string[], lingkunganId: string) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return false;
  const { data } = await db.from("section").select("id,kolekte_session(lingkungan_id)").in("id", unique);
  const rows = (data ?? []) as any[];
  return rows.length === unique.length && rows.every((r) => r.kolekte_session?.lingkungan_id === lingkunganId);
}

// ---------- PWA: pembuat ----------

export async function startSession(f: FormData) {
  const me = await requirePwa();
  const { data, error } = await db.rpc("open_session", {
    p_lingkungan: me.id,
    p_tanggal: str(f, "tanggal"),
    p_misa: str(f, "misa"),
    p_kategori: str(f, "kategori") || null,
    p_nama: str(f, "nama"),
  });
  if (error || !data) back("/", error?.message ?? "SESSION_NOT_FOUND");
  redirect(`/s/${data}`);
}

type Line = { nilai: string; qty: string };

// Nama input: qty__{nilai pecahan}
function parseLines(f: FormData): Line[] {
  const out: Line[] = [];
  for (const [k, v] of f.entries()) {
    if (!k.startsWith("qty__")) continue;
    const raw = String(v).trim();
    if (raw === "") continue;
    out.push({ nilai: k.slice(5), qty: raw });
  }
  return out;
}

export async function saveSection(f: FormData) {
  const me = await requirePwa();
  const session = str(f, "session");
  const tipe = str(f, "tipe");
  const path = `/s/${session}/${tipe}`;
  if (!isTipe(tipe)) back(`/s/${session}`, "TIPE_INVALID");
  if (!(await sessionOwnedBy(session, me.id))) back("/", "BUKAN_MILIK");

  const nama = str(f, "nama");
  const { error } = await db.rpc("save_section", {
    p_session: session,
    p_tipe: tipe,
    p_nama: nama,
    p_is_empty: f.get("kosong") === "on",
    p_lines: parseLines(f),
  });
  if (error) back(path, error.message);

  if (str(f, "intent") === "submit") {
    const sub = await db.rpc("submit_section", { p_session: session, p_tipe: tipe, p_nama: nama });
    if (sub.error) back(path, sub.error.message);
    redirect(`/s/${session}`);
  }
  redirect(`${path}?ok=1`);
}

// ---------- PWA: pereview (hanya data lingkungan sendiri) ----------

const reviewPath = (tanggal: string, misa: string, nama: string) =>
  `/review?tanggal=${encodeURIComponent(tanggal)}&misa=${encodeURIComponent(misa)}&nama=${encodeURIComponent(nama)}`;

// Approve semua bagian yang dicentang pereview (atomik).
export async function approveSections(f: FormData) {
  const me = await requirePwa();
  const nama = str(f, "nama");
  const path = reviewPath(str(f, "tanggal"), str(f, "misa"), nama);
  const ids = f.getAll("ids").map(String);
  if (!(await sectionsOwnedBy(ids, me.id))) back(path, "BUKAN_MILIK");
  const { error } = await db.rpc("approve_sections", { p_nama: nama, p_ids: ids });
  if (error) back(path, error.message);
  redirect(`${path}&ok=1`);
}

// Pereview mengedit isian dulu (status tetap menunggu), lalu kembali ke daftar untuk approve.
export async function reviewEdit(f: FormData) {
  const me = await requirePwa();
  const section = str(f, "section");
  const nama = str(f, "nama");
  const editPath = `/review/edit/${section}?nama=${encodeURIComponent(nama)}`;
  if (!(await sectionsOwnedBy([section], me.id))) back("/review", "BUKAN_MILIK");

  const { error } = await db.rpc("review_edit_section", {
    p_section: section,
    p_nama: nama,
    p_is_empty: f.get("kosong") === "on",
    p_lines: parseLines(f),
  });
  if (error) back(editPath, error.message);

  const { data } = await db
    .from("section")
    .select("kolekte_session(tanggal,misa_id)")
    .eq("id", section)
    .maybeSingle();
  const s: any = (data as any)?.kolekte_session;
  if (!s) redirect("/review");
  redirect(`${reviewPath(s.tanggal, s.misa_id, nama)}&ok=1`);
}

// ---------- Back Office ----------

export async function login(f: FormData) {
  const auth = await authClient();
  const { data, error } = await auth.auth.signInWithPassword({
    email: str(f, "email"),
    password: String(f.get("password") ?? ""),
  });
  if (error || !data.user) back("/admin/login", "LOGIN_FAILED");
  const { data: row } = await db.from("bo_user").select("role").eq("user_id", data!.user.id).maybeSingle();
  if (!row) {
    await auth.auth.signOut();
    back("/admin/login", "LOGIN_FAILED");
  }
  redirect("/admin");
}

export async function logout() {
  const auth = await authClient();
  await auth.auth.signOut();
  redirect("/admin/login");
}

export async function approveSession(f: FormData) {
  const user = await requireBo();
  const id = str(f, "id");
  const { error } = await db.rpc("bo_approve", { p_session: id, p_user: user.id, p_note: str(f, "note") });
  back(`/admin/${id}`, error?.message);
}

export async function returnSession(f: FormData) {
  const user = await requireBo();
  const id = str(f, "id");
  const { error } = await db.rpc("bo_return", {
    p_session: id,
    p_user: user.id,
    p_sections: f.getAll("sections").map(String),
    p_note: str(f, "note"),
  });
  back(`/admin/${id}`, error?.message);
}

// Admin / Admin Keuangan mereset PIN lingkungan. Lingkungan itu membuat PIN baru (dan mengulanginya) saat masuk berikutnya.
export async function resetPin(f: FormData) {
  const user = await requireBo();
  const { error } = await db.rpc("bo_reset_pin", { p_lingkungan: str(f, "lingkungan"), p_user: user.id });
  back("/admin/pin", error?.message);
}
