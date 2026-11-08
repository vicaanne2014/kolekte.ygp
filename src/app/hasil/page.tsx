import Link from "next/link";
import { db } from "@/lib/admin";
import { requirePwa } from "@/lib/pwa-auth";
import { ambilMisa } from "@/lib/misa";
import { KATEGORI_LABEL, KATEGORI_MISA, SECTIONS, STATUS_LABEL, rp } from "@/lib/kolekte";
import RekapKantong from "@/components/RekapKantong";

export const dynamic = "force-dynamic";

// Hasil akhir per misa (baca saja), HANYA untuk lingkungan yang sedang masuk.
// Misa berjenis MINGGU dipecah per Sabtu Sore / Minggu 1 / Minggu 2, tetapi hanya kategori yang dibuat lingkungan ini
// yang tampil. Jumat Pertama tanpa kolom kategori.
// Laporan lintas lingkungan hanya ada di Back Office. Finalisasi (Closed) oleh Admin Keuangan.
export default async function HasilPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; misa?: string }>;
}) {
  const me = await requirePwa();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const tanggal = sp.tanggal || today;

  const misas = await ambilMisa({ aktif: true });
  const misa = misas?.find((m) => m.id === sp.misa);

  let sessions: any[] = [];
  if (sp.misa) {
    const { data } = await db
      .from("kolekte_session")
      .select("id,kategori,status,grand_total,section(tipe,status,subtotal,section_line(nilai,qty,nilai_baris))")
      .eq("tanggal", tanggal)
      .eq("misa_id", sp.misa)
      .eq("lingkungan_id", me.id);
    sessions = data ?? [];
  }

  // Hanya sesi yang benar-benar dibuat lingkungan ini yang tampil. Kategori yang tidak dibuat
  // (mis. Sabtu Sore/Minggu 2 milik lingkungan lain) tidak muncul, bahkan sebagai "Belum ada data".
  const urutan: string[] = KATEGORI_MISA.map((k) => k.v);
  const rows = [...sessions].sort((a, b) => urutan.indexOf(a.kategori ?? "") - urutan.indexOf(b.kategori ?? ""));
  const pakaiKategori = misa?.jenis !== "JUMAT_PERTAMA";

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
      <div className="muted" style={{ marginBottom: 12 }}>{me.nama}</div>

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
            <div className="row total" style={{ fontSize: "1.2rem" }}><span>Total {me.nama}</span><span>{rp(total)}</span></div>
            <div className="muted">
              Sudah final: {closed.length} dari {sessions.length} sesi ({rp(totalFinal)}). Sisanya menunggu review.
            </div>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  {pakaiKategori && <th>Kategori</th>}
                  {SECTIONS.map((s) => <th key={s.tipe} className="num">{s.label.replace("Kantong ", "")}</th>)}
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    {pakaiKategori && <td>{KATEGORI_LABEL[s.kategori] ?? "—"}</td>}
                    {SECTIONS.map(({ tipe }) => {
                      const x = (s.section ?? []).find((y: any) => y.tipe === tipe);
                      return <td key={tipe} className="num">{x ? rp(x.subtotal) : "—"}</td>;
                    })}
                    <td className="num total">{rp(s.grand_total)}</td>
                    <td><span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={pakaiKategori ? 5 : 4}>Total</td>
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
