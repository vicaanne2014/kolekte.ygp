import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBo } from "@/lib/auth";
import { MASTER } from "@/lib/master";
import { addMaster } from "../../../master-actions";
import MasterField from "@/components/MasterField";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Halaman Tambah (baru) master data.
export default async function MasterBaru({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  await requireBo();
  const { key } = await params;
  const { e } = await searchParams;
  const def = MASTER[key];
  if (!def) notFound();

  return (
    <main>
      <h1>Tambah — {def.title}</h1>
      <Msg e={e} />
      <form action={addMaster} className="card">
        <input type="hidden" name="key" value={key} />
        {def.fields.map((f) => <MasterField key={f.name} f={f} />)}
        <div className="actions">
          <Link href={`/admin/master/${key}`} className="btn sec">Batal</Link>
          <button type="submit">Simpan</button>
        </div>
      </form>
    </main>
  );
}
