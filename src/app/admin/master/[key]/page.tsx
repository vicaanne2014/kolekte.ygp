import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { MASTER, type Field } from "@/lib/master";
import { addMaster, toggleMaster, updateMaster } from "../../master-actions";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

function Input({ f, value, id }: { f: Field; value?: any; id?: string }) {
  if (f.type === "checkbox")
    return <label style={{ margin: 0, color: "inherit" }}><input type="checkbox" name={f.name} defaultChecked={!!value} />{f.label}</label>;
  if (f.type === "select")
    return (
      <select name={f.name} defaultValue={value ?? ""} required aria-label={f.label} id={id}>
        <option value="" disabled>{f.label}…</option>
        {f.options!.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    );
  return (
    <input
      name={f.name}
      type={f.type === "number" ? "number" : "text"}
      defaultValue={value ?? (f.type === "number" ? 0 : "")}
      required={f.type === "text"}
      placeholder={f.label}
      aria-label={f.label}
      id={id}
    />
  );
}

export default async function MasterPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  await requireBo();
  const { key } = await params;
  const { e } = await searchParams;
  const def = MASTER[key];
  if (!def) notFound();

  let q = db.from(def.table).select("*");
  for (const o of def.order) q = q.order(o.col, { ascending: o.asc });
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const editable = def.fields.filter((f) => f.editable);
  const fixed = def.fields.filter((f) => !f.editable);
  const show = (f: Field, r: any) =>
    f.type === "select" ? f.options!.find((o) => o.v === r[f.name])?.l ?? r[f.name]
    : f.name === "nilai" ? new Intl.NumberFormat("id-ID").format(r[f.name]) : String(r[f.name]);

  return (
    <main className="wide">
      <p><Link href="/admin">← Daftar sesi</Link></p>
      <h1>Master Data</h1>
      <div className="actions" style={{ marginTop: 0, marginBottom: 16 }}>
        {Object.entries(MASTER).map(([k, d]) => (
          <Link key={k} href={`/admin/master/${k}`} className={k === key ? "btn" : "btn sec"}>{d.title}</Link>
        ))}
      </div>
      <Msg e={e} />

      <form action={addMaster} className="card">
        <h2 style={{ marginTop: 0 }}>Tambah — {def.title}</h2>
        <input type="hidden" name="key" value={key} />
        <div className="actions" style={{ marginTop: 0, alignItems: "center" }}>
          {def.fields.map((f) => <Input key={f.name} f={f} />)}
          <button type="submit">Tambah</button>
        </div>
      </form>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {fixed.map((f) => <th key={f.name}>{f.label}</th>)}
              {editable.length > 0 && <th>Ubah</th>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: r.aktif ? 1 : 0.55 }}>
                {fixed.map((f) => <td key={f.name}>{show(f, r)}</td>)}
                {editable.length > 0 && (
                  <td>
                    <form action={updateMaster} className="actions" style={{ marginTop: 0, alignItems: "center" }}>
                      <input type="hidden" name="key" value={key} />
                      <input type="hidden" name="id" value={r.id} />
                      {editable.map((f) => <Input key={f.name} f={f} value={r[f.name]} />)}
                      <button type="submit" className="sec">Simpan</button>
                    </form>
                  </td>
                )}
                <td>
                  <form action={toggleMaster}>
                    <input type="hidden" name="key" value={key} />
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="aktif" value={String(!r.aktif)} />
                    <button type="submit" className="sec">{r.aktif ? "Aktif — nonaktifkan" : "Nonaktif — aktifkan"}</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">Belum ada data.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted">Data tidak dihapus; yang sudah dipakai cukup dinonaktifkan.</p>
    </main>
  );
}
