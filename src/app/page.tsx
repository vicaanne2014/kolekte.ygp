import Link from "next/link";
import { db } from "@/lib/admin";
import { LINGKUNGAN } from "@/lib/kolekte";
import { startSession } from "./actions";
import NameField from "@/components/NameField";
import MisaFields from "@/components/MisaFields";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Alur pembuat: Nama → Tanggal → Misa (master) → Sabtu Sore/Minggu 1/Minggu 2 (kecuali Jumat Pertama) → Lingkungan.
export default async function Home({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const { data: misas } = await db
    .from("misa").select("id,nama,jenis").eq("aktif", true).order("urutan").order("nama");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <main>
      <div className="row">
        <h1>Kolekte</h1>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/review" className="btn sec">Review</Link>
          <Link href="/hasil" className="btn sec">Hasil</Link>
        </div>
      </div>
      <Msg e={e} />
      <form action={startSession} className="card">
        <NameField label="Nama Anda (pembuat)" />

        <label htmlFor="tanggal">Tanggal</label>
        <input id="tanggal" name="tanggal" type="date" required defaultValue={today} />

        <MisaFields misas={misas ?? []} />

        <label htmlFor="lingkungan">Lingkungan / Wilayah</label>
        <select id="lingkungan" name="lingkungan" required defaultValue="">
          <option value="" disabled>Pilih lingkungan…</option>
          {LINGKUNGAN.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        <div className="actions"><button type="submit">Lanjut</button></div>
      </form>
      <p className="muted">Data dengan lingkungan, tanggal, dan misa yang sama akan dilanjutkan, bukan dibuat ulang.</p>
    </main>
  );
}
