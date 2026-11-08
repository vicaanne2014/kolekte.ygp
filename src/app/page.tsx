import Link from "next/link";
import { db } from "@/lib/admin";
import { requirePwa } from "@/lib/pwa-auth";
import { keluar, startSession } from "./actions";
import NameField from "@/components/NameField";
import MisaFields from "@/components/MisaFields";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Alur pembuat: (sudah masuk sebagai lingkungan) Nama → Tanggal → Misa (master) → Sabtu Sore/Minggu 1/Minggu 2 (kecuali Jumat Pertama).
export default async function Home({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const me = await requirePwa();
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
      <div className="row muted" style={{ marginBottom: 12 }}>
        <span>Masuk sebagai <strong>{me.nama}</strong></span>
        <span className="actions" style={{ marginTop: 0 }}>
          <Link href="/pin" className="btn sec">Ganti PIN</Link>
          <form action={keluar}><button type="submit" className="sec">Keluar</button></form>
        </span>
      </div>
      <Msg e={e} />
      <form action={startSession} className="card">
        <NameField label="Nama Anda (pembuat)" />

        <label htmlFor="tanggal">Tanggal</label>
        <input id="tanggal" name="tanggal" type="date" required defaultValue={today} />

        <MisaFields misas={misas ?? []} />

        <div className="actions"><button type="submit">Lanjut</button></div>
      </form>
      <p className="muted">Data dengan tanggal dan misa yang sama akan dilanjutkan, bukan dibuat ulang.</p>
    </main>
  );
}
