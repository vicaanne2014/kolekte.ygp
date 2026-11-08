import { notFound } from "next/navigation";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { SECTIONS, STATUS_LABEL, misaLabel, rp } from "@/lib/kolekte";
import { approveSession, returnSession } from "@/app/actions";
import LinesTable from "@/components/LinesTable";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

export default async function AdminSession({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const user = await requireBo();
  const { id } = await params;
  const { e } = await searchParams;

  const { data: s } = await db.from("kolekte_session").select("*, misa(nama), lingkungan(nama)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const { data: secs } = await db
    .from("section")
    .select("id,tipe,status,subtotal,created_by_name,note,section_review(reviewer_name,aksi,waktu),section_line(nilai,qty,nilai_baris)")
    .eq("session_id", id);
  const by = new Map((secs ?? []).map((x: any) => [x.tipe, x]));

  const canReview = user.role === "ADMIN_KEUANGAN" && s.status === "READY_FOR_REVIEW";
  const approved = SECTIONS.filter(({ tipe }) => by.get(tipe)?.status === "APPROVED");

  return (
    <main className="wide">
      <div className="row">
        <h1>{s.lingkungan?.nama}</h1>
        <span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span>
      </div>
      <Msg e={e} />
      <div className="card">
        <div>{s.tanggal} · {misaLabel(s.misa?.nama, s.kategori)}</div>
        <div className="muted">Sesi dibuka oleh {s.created_by_name}</div>
        <div className="row total" style={{ marginTop: 8, fontSize: "1.2rem" }}><span>Total Keseluruhan</span><span>{rp(s.grand_total)}</span></div>
      </div>

      {SECTIONS.map(({ tipe, label }) => {
        const x: any = by.get(tipe);
        if (!x) return null;
        const reviews = [...(x.section_review ?? [])].sort((a: any, b: any) => (a.waktu < b.waktu ? 1 : -1));
        const last = reviews.find((r: any) => r.aksi === "APPROVE");
        return (
          <div className="card" key={tipe}>
            <div className="row">
              <strong>{label}</strong>
              <span className={`badge ${x.status}`}>{STATUS_LABEL[x.status]}</span>
            </div>
            <div className="muted">
              Pembuat: {x.created_by_name ?? "—"}{last && <> · Pereview: {last.reviewer_name}</>}
              {reviews.some((r: any) => r.aksi === "EDIT") && <> · Diedit oleh {[...new Set(reviews.filter((r: any) => r.aksi === "EDIT").map((r: any) => r.reviewer_name))].join(", ")}</>}
            </div>
            <LinesTable lines={x.section_line ?? []} />
            <div className="row total"><span>Subtotal {label}</span><span>{rp(x.subtotal)}</span></div>
          </div>
        );
      })}

      {canReview && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Review Total</h2>
          <form action={approveSession}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="ok">Setujui &amp; Tutup Sesi</button>
          </form>
          <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--line)" }} />
          <form action={returnSession}>
            <input type="hidden" name="id" value={id} />
            <div className="muted">Kembalikan bagian berikut untuk diperbaiki:</div>
            {approved.map(({ tipe, label }) => (
              <label key={tipe} style={{ color: "inherit", margin: "6px 0" }}>
                <input type="checkbox" name="sections" value={tipe} />{label}
              </label>
            ))}
            <label htmlFor="note">Catatan (wajib)</label>
            <textarea id="note" name="note" rows={2} required minLength={3} />
            <div className="actions"><button type="submit" className="sec">Kembalikan</button></div>
          </form>
        </div>
      )}
      {!canReview && s.status === "READY_FOR_REVIEW" && (
        <p className="muted">Hanya Admin Keuangan yang dapat menyetujui atau mengembalikan sesi.</p>
      )}
    </main>
  );
}
