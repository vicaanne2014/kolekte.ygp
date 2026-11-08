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

function done(key: string, error: boolean): never {
  redirect(`/admin/master/${key}${error ? "?e=MASTER_ERROR" : ""}`);
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

// Admin dan Admin Keuangan sama-sama boleh mengelola master data.
export async function addMaster(f: FormData) {
  await requireBo();
  const key = str(f, "key");
  if (!MASTER[key]) redirect("/admin");
  const row = collect(key, f, false);
  if (!row) done(key, true);
  const { error } = await db.from(MASTER[key].table).insert(row);
  done(key, !!error);
}

export async function updateMaster(f: FormData) {
  await requireBo();
  const key = str(f, "key");
  if (!MASTER[key]) redirect("/admin");
  const row = collect(key, f, true);
  if (!row) done(key, true);
  const { error } = await db.from(MASTER[key].table).update(row).eq("id", str(f, "id"));
  done(key, !!error);
}

// Hapus hanya bila belum dipakai (database menolak bila sudah dipakai); selain itu cukup dinonaktifkan.
export async function hapusMaster(f: FormData) {
  await requireBo();
  const key = str(f, "key");
  if (!MASTER[key]) redirect("/admin");
  const { error } = await db.from(MASTER[key].table).delete().eq("id", str(f, "id"));
  redirect(`/admin/master/${key}${error ? "?e=MASTER_DIPAKAI" : ""}`);
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
  done(key, !!error);
}
