import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { MASTER } from "@/lib/master";
import { updateMaster } from "../../../master-actions";
import MasterField from "@/components/MasterField";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Halaman Ubah master data.
export default async function MasterUbah({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  await requireBo();
  const { key, id } = await params;
  const { e } = await searchParams;
  const def = MASTER[key];
  if (!def || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await db
    .from(def.table)
    .select(["id", "aktif", ...def.fields.map((f) => f.name)].join(","))
    .eq("id", id)
    .maybeSingle();
  const row = data as any;
  if (!row) notFound();

  return (
    <main>
      <h1>Ubah — {def.title}</h1>
      <Msg e={e} />
      <form action={updateMaster} className="card">
        <input type="hidden" name="key" value={key} />
        <input type="hidden" name="id" value={id} />
        {def.fields.map((f) =>
          f.editable ? (
            <MasterField key={f.name} f={f} value={row[f.name]} />
          ) : (
            <div key={f.name}>
              <label>{f.label}</label>
              <div>{String(row[f.name])}</div>
            </div>
          )
        )}
        <div className="actions">
          <Link href={`/admin/master/${key}`} className="btn sec">Batal</Link>
          <button type="submit">Simpan</button>
        </div>
      </form>
    </main>
  );
}
