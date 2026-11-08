import Link from "next/link";
import { db } from "@/lib/admin";
import { SECTIONS, STATUS_LABEL, rp, sesiNama } from "@/lib/kolekte";
import { approveSections } from "@/app/actions";
import { requirePwa } from "@/lib/pwa-auth";
import NameField from "@/components/NameField";
import LinesTable from "@/components/LinesTable";
import ReviewForm, { type ReviewItem } from "@/components/ReviewForm";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Alur reviewer: pilih misa hari itu → isi nama → daftar detail → centang semua → approve (atau edit dulu).
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; misa?: string; nama?: string; e?: string; ok?: string }>;
}) {
  const me = await requirePwa();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const tanggal = sp.tanggal || today;
  const nama = (sp.nama ?? "").trim();

  const { data: misas } = await db.from("misa").select("id,nama").eq("aktif", true).order("urutan").order("nama");
  const ready = !!(sp.tanggal && sp.misa && nama);

  let sessions: any[] = [];
  if (ready) {
    const base = db
      .from("kolekte_session")
      .select("id,kategori,misa(nama),section(id,tipe,status,subtotal,created_by_name,section_line(nilai,qty,nilai_baris))")
      .eq("tanggal", tanggal)
      .eq("lingkungan_id", me.id);
    const { data } = await base.eq("misa_id", sp.misa!).order("created_at");
    sessions = data ?? [];
  }

  const items: ReviewItem[] = [];
  const others: { key: string; title: string; status: string }[] = [];
  for (const s of sessions)
    for (const { tipe, label } of SECTIONS) {
      const x = (s.section ?? []).find((y: any) => y.tipe === tipe);
      if (!x) { others.push({ key: `${s.id}-${tipe}`, title: `${sesiNama(me.nama, s.kategori)} — ${label}`, status: "BELUM" }); continue; }
      const title = `${sesiNama(me.nama, s.kategori)} — ${label}`;
      if (x.status !== "SUBMITTED") { others.push({ key: x.id, title, status: x.status }); continue; }
      items.push({
        id: x.id,
        title,
        node: (
          <div>
            <div className="muted">Dibuat oleh {x.created_by_name}</div>
            <LinesTable lines={x.section_line ?? []} />
            <div className="row total" style={{ margin: "8px 0" }}><span>Subtotal</span><span>{rp(x.subtotal)}</span></div>
            <Link href={`/review/edit/${x.id}?nama=${encodeURIComponent(nama)}`} className="btn sec">Edit dulu</Link>
          </div>
        ),
      });
    }

  const misaNama = sessions[0] ? sessions[0].misa?.nama ?? "" : "";

  return (
    <main>
      <p><Link href="/">← Kembali</Link></p>
      <h1>Review</h1>
      <div className="muted" style={{ marginBottom: 12 }}>{me.nama}</div>
      <Msg e={sp.e} ok={sp.ok} />

      <form method="GET" action="/review" className="card">
        <label htmlFor="tanggal">Tanggal</label>
        <input id="tanggal" name="tanggal" type="date" required defaultValue={tanggal} />
        <label htmlFor="misa">Misa</label>
        <select id="misa" name="misa" required defaultValue={sp.misa ?? ""}>
          <option value="" disabled>Pilih misa…</option>
          {misas?.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
        </select>
        <NameField label="Nama Anda (pereview)" defaultValue={nama} />
        <div className="actions"><button type="submit">Tampilkan</button></div>
      </form>

      {ready && sessions.length === 0 && <p className="muted">Belum ada data untuk misa dan tanggal ini.</p>}

      {ready && sessions.length > 0 && (
        <>
          <h2>{tanggal} · {misaNama}</h2>
          {items.length > 0 ? (
            <ReviewForm action={approveSections} items={items} nama={nama} tanggal={tanggal} misa={sp.misa!} />
          ) : (
            <p className="muted">Tidak ada bagian yang menunggu review.</p>
          )}
          {others.length > 0 && (
            <div className="card">
              <strong>Belum bisa direview / sudah selesai</strong>
              {others.map((o) => (
                <div className="row" key={o.key}><span>{o.title}</span><span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span></div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
