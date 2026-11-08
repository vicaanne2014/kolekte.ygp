import Link from "next/link";
import { db } from "@/lib/admin";
import { LINGKUNGAN, SECTIONS, STATUS_LABEL, misaLabel, rp } from "@/lib/kolekte";

export const dynamic = "force-dynamic";

// Hasil akhir per misa (baca saja): total per lingkungan dan kantong, rekap per pecahan.
// Finalisasi (Closed) tetap dilakukan Admin Keuangan di Back Office.
export default async function HasilPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; misa?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const tanggal = sp.tanggal || today;

  const { data: misas } = await db.from("misa").select("id,nama").eq("aktif", true).order("urutan").order("nama");

  let sessions: any[] = [];
  if (sp.misa) {
    const { data } = await db
      .from("kolekte_session")
      .select("id,lingkungan,bulan,status,grand_total,misa(nama),section(tipe,status,subtotal,section_line(nilai,qty,nilai_baris))")
      .eq("tanggal", tanggal)
      .eq("misa_id", sp.misa);
    sessions = data ?? [];
  }

  const by = new Map(sessions.map((s) => [s.lingkungan, s]));
  const total = sessions.reduce((t, s) => t + Number(s.grand_total), 0);
  const totalFinal = sessions.filter((s) => s.status === "CLOSED").reduce((t, s) => t + Number(s.grand_total), 0);
  const nFinal = sessions.filter((s) => s.status === "CLOSED").length;

  const rekap = new Map<number, number>();
  for (const s of sessions)
    for (const x of s.section ?? [])
      for (const l of x.section_line ?? []) rekap.set(l.nilai, (rekap.get(l.nilai) ?? 0) + l.qty);

  const misaNama = sessions[0] ? misaLabel(sessions[0].misa.nama, sessions[0].bulan) : "";

  return (
    <main className="wide">
      <p><Link href="/">← Kembali</Link></p>
      <h1>Hasil Akhir</h1>

      <form method="GET" action="/hasil" className="card" style={{ maxWidth: 640 }}>
        <label htmlFor="tanggal">Tanggal</label>
        <input id="tanggal" name="tanggal" type="date" required defaultValue={tanggal} />
        <label htmlFor="misa">Misa</label>
        <select id="misa" name="misa" required defaultValue={sp.misa ?? ""}>
          <option value="" disabled>Pilih misa…</option>
          {misas?.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
        </select>
        <div className="actions"><button type="submit">Tampilkan</button></div>
      </form>

      {sp.misa && sessions.length === 0 && <p className="muted">Belum ada data untuk misa dan tanggal ini.</p>}

      {sessions.length > 0 && (
        <>
          <h2>{tanggal} · {misaNama}</h2>
          <div className="card">
            <div className="row total" style={{ fontSize: "1.2rem" }}><span>Total semua lingkungan</span><span>{rp(total)}</span></div>
            <div className="muted">
              Sudah final: {nFinal} dari {sessions.length} lingkungan yang ada datanya ({rp(totalFinal)}).
              {" "}Sisanya menunggu review.
            </div>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Lingkungan</th>
                  {SECTIONS.map((s) => <th key={s.tipe} className="num">{s.label.replace("Kantong ", "")}</th>)}
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {LINGKUNGAN.map((nama) => {
                  const s = by.get(nama);
                  if (!s) return (
                    <tr key={nama} className="muted"><td>{nama}</td><td colSpan={6}>Belum ada data</td></tr>
                  );
                  return (
                    <tr key={nama}>
                      <td>{nama}</td>
                      {SECTIONS.map(({ tipe }) => {
                        const x = (s.section ?? []).find((y: any) => y.tipe === tipe);
                        return <td key={tipe} className="num">{x ? rp(x.subtotal) : "—"}</td>;
                      })}
                      <td className="num total">{rp(s.grand_total)}</td>
                      <td><span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
                    </tr>
                  );
                })}
                <tr className="total">
                  <td colSpan={5}>Total</td>
                  <td className="num">{rp(total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card" style={{ maxWidth: 640 }}>
            <h2 style={{ marginTop: 0 }}>Rekap per Pecahan</h2>
            <table>
              <thead><tr><th>Pecahan</th><th className="num">Jumlah lembar/koin</th><th className="num">Nilai</th></tr></thead>
              <tbody>
                {[...rekap.entries()].sort((a, b) => b[0] - a[0]).map(([nilai, qty]) => (
                  <tr key={nilai}><td>{rp(nilai)}</td><td className="num">{qty}</td><td className="num">{rp(nilai * qty)}</td></tr>
                ))}
                <tr className="total"><td colSpan={2}>Total</td><td className="num">{rp(total)}</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
