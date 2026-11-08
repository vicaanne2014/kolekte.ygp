import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { MASTER, type Field } from "@/lib/master";
import { urutMisa } from "@/lib/misa";
import { hapusMaster, toggleMaster } from "../../master-actions";
import ConfirmButton from "@/components/ConfirmButton";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Daftar master data: cari nama, filter status (dan jenis untuk Misa). Tambah dan Ubah di halaman sendiri.
export default async function MasterList({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ q?: string; st?: string; jenis?: string; e?: string; ok?: string }>;
}) {
  await requireBo();
  const { key } = await params;
  const sp = await searchParams;
  const def = MASTER[key];
  if (!def) notFound();

  const q = (sp.q ?? "").trim();
  const st = sp.st === "aktif" || sp.st === "nonaktif" ? sp.st : "";
  const jenisField = def.fields.find((f) => f.name === "jenis");
  const jenis = jenisField?.options?.some((o) => o.v === sp.jenis) ? (sp.jenis as string) : "";

  // Tabel tanpa kolom rahasia (Misa) dibaca penuh agar created_at ikut; lainnya hanya kolom yang ditampilkan.
  let query = db.from(def.table).select(def.newestFirst ? "*" : ["id", "aktif", ...def.fields.map((f) => f.name)].join(","));
  if (st) query = query.eq("aktif", st === "aktif");
  if (jenis) query = query.eq("jenis", jenis);
  if (q) query = query.ilike("nama", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  for (const o of def.order) query = query.order(o.col, { ascending: o.asc });
  const { data } = await query;
  const rows = def.newestFirst ? urutMisa((data ?? []) as any[]) : ((data ?? []) as any[]);

  // Alamat daftar saat ini, agar setelah Nonaktifkan/Hapus pencarian dan filter tidak hilang
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (st) qs.set("st", st);
  if (jenis) qs.set("jenis", jenis);
  const kembali = `/admin/master/${key}${qs.toString() ? `?${qs}` : ""}`;

  const show = (f: Field, r: any) =>
    f.type === "select" ? f.options!.find((o) => o.v === r[f.name])?.l ?? r[f.name] : String(r[f.name]);
  const filtered = !!(q || st || jenis);

  return (
    <main className="wide">
      <div className="toolbar">
        <h1>{def.title}</h1>
        <Link href={`/admin/master/${key}/baru`} className="btn">+ Tambah</Link>
      </div>
      <Msg e={sp.e} ok={sp.ok} />

      <form method="GET" className="card filters">
        <div className="f wide">
          <label htmlFor="q">Cari nama</label>
          <input id="q" name="q" defaultValue={q} placeholder="Ketik nama…" />
        </div>
        <div className="f">
          <label htmlFor="st">Status</label>
          <select id="st" name="st" defaultValue={st}>
            <option value="">Semua</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
        {jenisField && (
          <div className="f">
            <label htmlFor="jenis">Jenis</label>
            <select id="jenis" name="jenis" defaultValue={jenis}>
              <option value="">Semua</option>
              {jenisField.options!.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        )}
        <div className="go">
          <button type="submit">Terapkan</button>
          {filtered && <Link href={`/admin/master/${key}`} className="btn sec">Reset</Link>}
        </div>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              {def.fields.map((f) => <th key={f.name}>{f.label.replace(/\s*\(.*\)/, "")}</th>)}
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: r.aktif ? 1 : 0.6 }}>
                {def.fields.map((f) => <td key={f.name}>{show(f, r)}</td>)}
                <td>{r.aktif ? <span className="badge APPROVED">Aktif</span> : <span className="badge">Nonaktif</span>}</td>
                <td>
                  <div className="rowbtns">
                    <Link href={`/admin/master/${key}/${r.id}`} className="btn sm sec">Ubah</Link>
                    <form action={toggleMaster}>
                      <input type="hidden" name="key" value={key} />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="aktif" value={String(!r.aktif)} />
                      <input type="hidden" name="kembali" value={kembali} />
                      <button type="submit" className="sec sm">{r.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
                    </form>
                    <form action={hapusMaster}>
                      <input type="hidden" name="key" value={key} />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="kembali" value={kembali} />
                      <ConfirmButton className="sec sm danger" message={`Hapus "${r.nama}"? Data yang sudah dipakai tidak bisa dihapus.`}>
                        Hapus
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={def.fields.length + 2} className="muted">{filtered ? "Tidak ada data yang cocok." : "Belum ada data."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">{rows.length} data. Hapus hanya bisa untuk data yang belum dipakai; yang sudah dipakai cukup dinonaktifkan.</p>
    </main>
  );
}
