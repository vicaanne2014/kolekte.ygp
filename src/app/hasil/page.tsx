import Link from "next/link";
import { db } from "@/lib/admin";
import { KATEGORI_MISA, LINGKUNGAN, SECTIONS, STATUS_LABEL, rp } from "@/lib/kolekte";
import RekapKantong from "@/components/RekapKantong";

export const dynamic = "force-dynamic";

// Hasil akhir per misa (baca saja): total per lingkungan dan kantong, rekap per pecahan.
// Misa berjenis MINGGU dipecah per Sabtu Sore / Minggu 1 / Minggu 2; Jumat Pertama satu kelompok.
// Finalisasi (Closed) tetap dilakukan Admin Keuangan di Back Office.
export default async function HasilPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; misa?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const tanggal = sp.tanggal || today;

  const { data: misas } = await db
    .from("misa").select("id,nama,jenis").eq("aktif", true).order("urutan").order("nama");
  const misa = misas?.find((m) => m.id === sp.misa);

  let sessions: any[] = [];
  if (sp.misa) {
    const { data } = await db
      .from("kolekte_session")
      .select("id,lingkungan,kategori,status,grand_total,section(tipe,status,subtotal,section_line(nilai,qty,nilai_baris))")
      .eq("tanggal", tanggal)
      .eq("misa_id", sp.misa);
    sessions = data ?? [];
  }

  // Kelompok baris: tiap kategori (misa Minggu) atau satu kelompok tanpa kategori (Jumat Pertama)
  const groups: { v: string | null; l: string | null }[] =
    misa?.jenis === "JUMAT_PERTAMA" ? [{ v: null, l: null }] : KATEGORI_MISA.map((k) => ({ v: k.v, l: k.l }));
  const by = new Map(sessions.map((s) => [`${s.lingkungan}|${s.kategori ?? ""}`, s]));

  const total = sessions.reduce((t, s) => t + Number(s.grand_total), 0);
  const closed = sessions.filter((s) => s.status === "CLOSED");
  const totalFinal = closed.reduce((t, s) => t + Number(s.grand_total), 0);

  // Rekap per pecahan, dipisah per kantong (tidak digabung)
  const rekap = SECTIONS.map(({ tipe, label }) => {
    const m = new Map<number, number>();
    for (const s of sessions)
      for (const x of s.section ?? [])
        if (x.tipe === tipe)
          for (const l of x.section_line ?? []) m.set(l.nilai, (m.get(l.nilai) ?? 0) + l.qty);
    return { tipe, label, lines: [...m.entries()].map(([nilai, qty]) => ({ nilai, qty })) };
  });

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
          <h2>{tanggal} · {misa?.nama}</h2>
          <div className="card">
            <div className="row total" style={{ fontSize: "1.2rem" }}><span>Total semua lingkungan</span><span>{rp(total)}</span></div>
            <div className="muted">
              Sudah final: {closed.length} dari {sessions.length} sesi yang ada datanya ({rp(totalFinal)}).
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
                {groups.map((g) => (
                  <GroupRows key={g.v ?? "-"} g={g} by={by} />
                ))}
                <tr className="total">
                  <td colSpan={5}>Total</td>
                  <td className="num">{rp(total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Rekap per Pecahan (per kantong)</h2>
          <RekapKantong data={rekap} />
        </>
      )}
    </main>
  );
}

function GroupRows({ g, by }: { g: { v: string | null; l: string | null }; by: Map<string, any> }) {
  return (
    <>
      {g.l && <tr><td colSpan={7} style={{ background: "var(--bg)", fontWeight: 600 }}>{g.l}</td></tr>}
      {LINGKUNGAN.map((nama) => {
        const s = by.get(`${nama}|${g.v ?? ""}`);
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
    </>
  );
}
