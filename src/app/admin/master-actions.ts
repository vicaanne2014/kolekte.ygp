"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { MASTER, type Field } from "@/lib/master";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function value(field: Field, f: FormData): string | number | boolean | null {
  if (field.type === "checkbox") return f.get(field.name) === "on";
  const raw = str(f, field.name);
  if (field.type === "number") {
    const n = Number(raw === "" ? 0 : raw);
    return Number.isInteger(n) ? n : NaN;
  }
  if (field.type === "select" && !field.options?.some((o) => o.v === raw)) return null;
  return raw === "" ? null : raw;
}

function collect(key: string, f: FormData, onlyEditable: boolean) {
  const def = MASTER[key];
  const row: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (onlyEditable && !field.editable) continue;
    const v = value(field, f);
    if (v === null || (typeof v === "number" && Number.isNaN(v))) return null;
    row[field.name] = v;
  }
  return row;
}

const withParam = (url: string, k: string, v: string) => `${url}${url.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`;

// Kembali ke daftar dengan pencarian/filter yang sama (hanya alamat di dalam master ini yang dipakai).
function kembali(f: FormData, key: string) {
  const k = str(f, "kembali");
  return k.startsWith(`/admin/master/${key}`) && !k.startsWith("//") ? k : `/admin/master/${key}`;
}

// Admin dan Admin Keuangan sama-sama boleh mengelola master data.
export async function addMaster(f: FormData) {
  await requireBo();
  const key = str(f, "key");
  if (!MASTER[key]) redirect("/admin");
  const baru = `/admin/master/${key}/baru`;
  const row = collect(key, f, false);
  if (!row) redirect(withParam(baru, "e", "MASTER_ERROR"));
  const { error } = await db.from(MASTER[key].table).insert(row);
  if (error) redirect(withParam(baru, "e", "MASTER_ERROR"));
  redirect(withParam(`/admin/master/${key}`, "ok", "created"));
}

export async function updateMaster(f: FormData) {
  await requireBo();
  const key = str(f, "key");
  if (!MASTER[key]) redirect("/admin");
  const id = str(f, "id");
  const ubah = `/admin/master/${key}/${id}`;
  const row = collect(key, f, true);
  if (!row) redirect(withParam(ubah, "e", "MASTER_ERROR"));
  const { error } = await db.from(MASTER[key].table).update(row).eq("id", id);
  if (error) redirect(withParam(ubah, "e", "MASTER_ERROR"));
  redirect(withParam(`/admin/master/${key}`, "ok", "updated"));
}

// Hapus hanya bila belum dipakai (database menolak bila sudah dipakai); selain itu cukup dinonaktifkan.
export async function hapusMaster(f: FormData) {
  await requireBo();
  const key = str(f, "key");
  if (!MASTER[key]) redirect("/admin");
  const { error } = await db.from(MASTER[key].table).delete().eq("id", str(f, "id"));
  const url = kembali(f, key);
  redirect(error ? withParam(url, "e", "MASTER_DIPAKAI") : withParam(url, "ok", "deleted"));
}

// Nonaktifkan / aktifkan kembali.
export async function toggleMaster(f: FormData) {
  await requireBo();
  const key = str(f, "key");
  if (!MASTER[key]) redirect("/admin");
  const { error } = await db
    .from(MASTER[key].table)
    .update({ aktif: f.get("aktif") === "true" })
    .eq("id", str(f, "id"));
  const url = kembali(f, key);
  redirect(error ? withParam(url, "e", "MASTER_ERROR") : withParam(url, "ok", f.get("aktif") === "true" ? "aktif" : "nonaktif"));
}
