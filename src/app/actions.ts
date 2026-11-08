"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/admin";
import { authClient, requireBo } from "@/lib/auth";
import { isTipe } from "@/lib/kolekte";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function back(path: string, error?: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}e=${encodeURIComponent(error)}` : path);
}

// ---------- PWA: pembuat (tanpa login) ----------

export async function startSession(f: FormData) {
  const { data, error } = await db.rpc("open_session", {
    p_lingkungan: str(f, "lingkungan"),
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
  const session = str(f, "session");
  const tipe = str(f, "tipe");
  const path = `/s/${session}/${tipe}`;
  if (!isTipe(tipe)) back(`/s/${session}`, "TIPE_INVALID");

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

// ---------- PWA: reviewer (tanpa login) ----------

const reviewPath = (tanggal: string, misa: string, nama: string) =>
  `/review?tanggal=${encodeURIComponent(tanggal)}&misa=${encodeURIComponent(misa)}&nama=${encodeURIComponent(nama)}`;

// Approve semua bagian yang dicentang reviewer (atomik).
export async function approveSections(f: FormData) {
  const nama = str(f, "nama");
  const path = reviewPath(str(f, "tanggal"), str(f, "misa"), nama);
  const { error } = await db.rpc("approve_sections", {
    p_nama: nama,
    p_ids: f.getAll("ids").map(String),
  });
  if (error) back(path, error.message);
  redirect(`${path}&ok=1`);
}

// Reviewer mengedit isian dulu (status tetap menunggu), lalu kembali ke daftar untuk approve.
export async function reviewEdit(f: FormData) {
  const section = str(f, "section");
  const nama = str(f, "nama");
  const editPath = `/review/edit/${section}?nama=${encodeURIComponent(nama)}`;
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
