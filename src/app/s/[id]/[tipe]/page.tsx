import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/admin";
import { SECTIONS, STATUS_LABEL, isTipe, rp } from "@/lib/kolekte";
import { saveSection } from "@/app/actions";
import SectionForm from "@/components/SectionForm";
import LinesTable from "@/components/LinesTable";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tipe: string }>;
  searchParams: Promise<{ e?: string; ok?: string }>;
}) {
  const { id, tipe } = await params;
  const { e, ok } = await searchParams;
  if (!isTipe(tipe)) notFound();
  const meta = SECTIONS.find((s) => s.tipe === tipe)!;

  const { data: session } = await db.from("kolekte_session").select("status").eq("id", id).maybeSingle();
  if (!session) notFound();
  const { data: sec } = await db.from("section").select("*").eq("session_id", id).eq("tipe", tipe).maybeSingle();
  const { data: lines } = sec
    ? await db
        .from("section_line")
        .select("nilai,qty,nilai_baris")
        .eq("section_id", sec.id)
    : { data: [] as any[] };

  const status: string = sec?.status ?? "DRAFT";
  const editable = session.status !== "CLOSED" && status === "DRAFT";

  const readLines = (lines ?? []) as { nilai: number; qty: number; nilai_baris: number }[];
  const initial: Record<number, number> = {};
  for (const l of readLines) initial[l.nilai] = l.qty;

  return (
    <main>
      <p><Link href={`/s/${id}`}>← Kembali ke daftar kantong</Link></p>
      <div className="row">
        <h1>{meta.label}</h1>
        <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <Msg e={e} ok={ok} />
      {sec?.note && status !== "APPROVED" && <div className="err">Catatan: {sec.note}</div>}

      {editable && (
        <SectionForm
          action={saveSection}
          hidden={{ session: id, tipe }}
          initial={initial}
          isEmpty={sec?.is_empty ?? false}
        />
      )}

      {!editable && sec && (
        <div className="card">
          <LinesTable lines={readLines} />
          <div className="row total" style={{ marginTop: 8 }}><span>Total</span><span>{rp(sec.subtotal)}</span></div>
          <div className="muted">Dibuat oleh: {sec.created_by_name}</div>
          {status === "SUBMITTED" && <div className="muted">Menunggu review. Reviewer membukanya lewat menu Review.</div>}
        </div>
      )}
    </main>
  );
}
