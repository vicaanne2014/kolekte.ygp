import { redirect } from "next/navigation";
import { db } from "@/lib/admin";
import { getPwaSession } from "@/lib/pwa-auth";
import { masuk } from "../actions";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Masuk PWA: pilih lingkungan/wilayah + PIN 6 angka.
// PIN awal semua lingkungan: 123456. Setelah masuk, lingkungan wajib "Reset PIN" (mengganti PIN bawaan) sekali.
export default async function MasukPage({ searchParams }: { searchParams: Promise<{ l?: string; e?: string }> }) {
  if (await getPwaSession()) redirect("/");
  const { l, e } = await searchParams;
  const { data: daftar } = await db
    .from("lingkungan").select("id,nama").eq("aktif", true).order("urutan").order("nama");

  return (
    <main>
      <h1>Kolekte</h1>
      <Msg e={e} />
      <form action={masuk} className="card">
        <label htmlFor="lingkungan">Lingkungan / Wilayah</label>
        <select id="lingkungan" name="lingkungan" required defaultValue={l ?? ""}>
          <option value="" disabled>Pilih lingkungan / wilayah…</option>
          {daftar?.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
        </select>

        <label htmlFor="pin">PIN (6 angka)</label>
        <input
          id="pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}"
          minLength={6} maxLength={6} required autoComplete="off" placeholder="6 angka"
        />
        <div className="actions"><button type="submit">Masuk</button></div>
        <p className="muted">Lupa PIN? Minta Admin untuk mereset.</p>
      </form>
    </main>
  );
}
