import { db } from "@/lib/admin";
import { requirePwa } from "@/lib/pwa-auth";
import { ambilMisa } from "@/lib/misa";
import { startSession } from "./actions";
import NameField from "@/components/NameField";
import MisaFields from "@/components/MisaFields";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Alur pembuat: (sudah masuk sebagai lingkungan) Nama → Tanggal → Misa (master) → Sabtu Sore/Minggu 1/Minggu 2 (kecuali Jumat Pertama).
export default async function Home({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const me = await requirePwa();
  const { e } = await searchParams;
  const misas = await ambilMisa({ aktif: true });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <main>
      <h1>Isi Kolekte</h1>
      <div className="muted" style={{ marginBottom: 12 }}>Masuk sebagai <strong>{me.nama}</strong></div>
      <Msg e={e} />
      <form action={startSession} className="card">
        <NameField label="Nama Anda (pembuat)" />

        <label htmlFor="tanggal">Tanggal</label>
        <input id="tanggal" name="tanggal" type="date" required defaultValue={today} />

        <MisaFields misas={misas} />

        <div className="actions"><button type="submit">Lanjut</button></div>
      </form>
      <p className="muted">Data dengan tanggal dan misa yang sama akan dilanjutkan, bukan dibuat ulang.</p>
    </main>
  );
}
