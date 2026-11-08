import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/admin";
import { SECTIONS, STATUS_LABEL, misaLabel, rp } from "@/lib/kolekte";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: s } = await db
    .from("kolekte_session")
    .select("*, misa(nama)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const { data: secs } = await db.from("section").select("tipe,status,subtotal,note").eq("session_id", id);
  const by = new Map((secs ?? []).map((x) => [x.tipe, x]));

  return (
    <main>
      <p><Link href="/">← Kembali</Link></p>
      <h1>{s.lingkungan}</h1>
      <div className="card">
        <div className="row"><span>{s.tanggal} · {misaLabel(s.misa.nama, s.bulan)}</span>
          <span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span></div>
        <div className="row total" style={{ marginTop: 8 }}><span>Total</span><span>{rp(s.grand_total)}</span></div>
        {s.status === "READY_FOR_REVIEW" && <div className="muted">Menunggu review Admin Keuangan.</div>}
        {s.status === "CLOSED" && <div className="muted">Sesi sudah final.</div>}
      </div>

      <p className="muted">Keempat kantong wajib diisi. Bila nilainya 0, submit dengan centang "Kosong".</p>

      {SECTIONS.map(({ tipe, label }) => {
        const x = by.get(tipe);
        const st = x?.status ?? "BELUM";
        return (
          <Link key={tipe} href={`/s/${id}/${tipe}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card">
              <div className="row">
                <strong>{label}</strong>
                <span className={`badge ${st}`}>{STATUS_LABEL[st]}</span>
              </div>
              <div className="muted">{x ? rp(x.subtotal) : "—"}</div>
              {x?.note && st !== "APPROVED" && <div className="muted">Catatan: {x.note}</div>}
            </div>
          </Link>
        );
      })}
    </main>
  );
}
