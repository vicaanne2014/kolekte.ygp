import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/admin";
import { SECTIONS, isTipe } from "@/lib/kolekte";
import { reviewEdit } from "@/app/actions";
import SectionForm from "@/components/SectionForm";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Reviewer mengedit isian yang sudah disubmit, lalu kembali ke daftar untuk approve.
export default async function ReviewEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ nama?: string; e?: string }>;
}) {
  const { sectionId } = await params;
  const { nama = "", e } = await searchParams;
  if (!nama.trim()) redirect("/review");

  const { data: sec } = await db
    .from("section")
    .select("id,tipe,status,is_empty,created_by_name,kolekte_session(tanggal,misa_id,lingkungan)")
    .eq("id", sectionId)
    .maybeSingle();
  if (!sec || !isTipe(sec.tipe)) notFound();
  const sess: any = (sec as any).kolekte_session;
  const back = `/review?tanggal=${sess.tanggal}&misa=${sess.misa_id}&nama=${encodeURIComponent(nama)}`;
  const label = SECTIONS.find((s) => s.tipe === sec.tipe)!.label;

  const { data: lines } = await db
    .from("section_line").select("nilai,qty").eq("section_id", sectionId);
  const initial: Record<number, number> = {};
  for (const l of lines ?? []) initial[l.nilai] = l.qty;

  return (
    <main>
      <p><Link href={back}>← Kembali ke daftar review</Link></p>
      <h1>Edit — {label}</h1>
      <div className="muted" style={{ marginBottom: 12 }}>{sess.lingkungan} · dibuat oleh {sec.created_by_name} · diedit oleh {nama}</div>
      <Msg e={e} />
      {sec.status !== "SUBMITTED" ? (
        <p className="muted">Bagian ini tidak lagi menunggu review.</p>
      ) : (
        <SectionForm
          action={reviewEdit}
          hidden={{ section: sectionId, nama }}
          reviewer
          initial={initial}
          isEmpty={sec.is_empty}
        />
      )}
    </main>
  );
}
