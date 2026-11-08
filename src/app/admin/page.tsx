import Link from "next/link";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { KATEGORI_LABEL, STATUS_LABEL, misaLabel, rp } from "@/lib/kolekte";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

const STATUS_SESI = ["IN_PROGRESS", "READY_FOR_REVIEW", "RETURNED", "CLOSED"];
const UUID = /^[0-9a-f-]{36}$/i;
const TGL = /^\d{4}-\d{2}-\d{2}$/;

type SP = { q?: string; status?: string; l?: string; m?: string; dari?: string; sampai?: string; e?: string };

// Daftar sesi (lintas lingkungan): cari teks, filter status, lingkungan, misa, dan rentang tanggal.
export default async function AdminHome({ searchParams }: { searchParams: Promise<SP> }) {
  await requireBo();
  const sp = await searchParams;
  const qRaw = (sp.q ?? "").trim();
  const status = STATUS_SESI.includes(sp.status ?? "") ? sp.status! : "";
  const l = UUID.test(sp.l ?? "") ? sp.l! : "";
  const m = UUID.test(sp.m ?? "") ? sp.m! : "";
  const dari = TGL.test(sp.dari ?? "") ? sp.dari! : "";
  const sampai = TGL.test(sp.sampai ?? "") ? sp.sampai! : "";

  const [{ data: daftarLing }, { data: daftarMisa }] = await Promise.all([
    db.from("lingkungan").select("id,nama").order("urutan").order("nama"),
    db.from("misa").select("id,nama").order("urutan").order("nama"),
  ]);

  let query = db
    .from("kolekte_session")
    .select("id,tanggal,kategori,status,grand_total,created_by_name,lingkungan(nama),misa(nama)")
    .order("tanggal", { ascending: false })
    .limit(500);
  if (status) query = query.eq("status", status);
  if (l) query = query.eq("lingkungan_id", l);
  if (m) query = query.eq("misa_id", m);
  if (dari) query = query.gte("tanggal", dari);
  if (sampai) query = query.lte("tanggal", sampai);
  const { data } = await query;

  let rows = (data ?? []) as any[];
  if (qRaw) {
    const q = qRaw.toLowerCase();
    rows = rows.filter((s) =>
      [s.lingkungan?.nama, s.misa?.nama, KATEGORI_LABEL[s.kategori] ?? "", s.created_by_name, s.tanggal]
        .join(" ").toLowerCase().includes(q)
    );
  }
  // Antrean "Siap direview" di paling atas
  rows.sort((a, b) => Number(b.status === "READY_FOR_REVIEW") - Number(a.status === "READY_FOR_REVIEW"));
  const filtered = !!(qRaw || status || l || m || dari || sampai);

  return (
    <main className="wide">
      <div className="toolbar">
        <h1>Sesi Kolekte</h1>
      </div>
      <Msg e={sp.e} />

      <form method="GET" className="card filters">
        <div className="f wide">
          <label htmlFor="q">Cari</label>
          <input id="q" name="q" defaultValue={qRaw} placeholder="Lingkungan, misa, nama pembuat…" />
        </div>
        <div className="f">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="">Semua</option>
            {STATUS_SESI.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="f">
          <label htmlFor="l">Lingkungan</label>
          <select id="l" name="l" defaultValue={l}>
            <option value="">Semua</option>
            {daftarLing?.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
          </select>
        </div>
        <div className="f">
          <label htmlFor="m">Misa</label>
          <select id="m" name="m" defaultValue={m}>
            <option value="">Semua</option>
            {daftarMisa?.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
          </select>
        </div>
        <div className="f">
          <label htmlFor="dari">Dari tanggal</label>
          <input id="dari" name="dari" type="date" defaultValue={dari} />
        </div>
        <div className="f">
          <label htmlFor="sampai">Sampai tanggal</label>
          <input id="sampai" name="sampai" type="date" defaultValue={sampai} />
        </div>
        <div className="go">
          <button type="submit">Terapkan</button>
          {filtered && <Link href="/admin" className="btn sec">Reset</Link>}
        </div>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Lingkungan</th><th>Misa</th><th>Status</th><th className="num">Total</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.tanggal}</td>
                <td>{s.lingkungan?.nama}</td>
                <td>{misaLabel(s.misa?.nama, s.kategori)}</td>
                <td><span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
                <td className="num">{rp(s.grand_total)}</td>
                <td><Link href={`/admin/${s.id}`} className="btn sm sec">Buka</Link></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="muted">{filtered ? "Tidak ada sesi yang cocok." : "Belum ada sesi."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">{rows.length} sesi{rows.length >= 500 && !qRaw ? " (maksimal 500 terbaru; persempit dengan filter)" : ""}.</p>
    </main>
  );
}
