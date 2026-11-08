import Link from "next/link";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { resetPin } from "../../actions";
import ConfirmButton from "@/components/ConfirmButton";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

const STATUS_PIN = [
  { v: "bawaan", l: "PIN bawaan (belum diganti)" },
  { v: "diganti", l: "Sudah diganti" },
  { v: "terkunci", l: "Terkunci sementara" },
];

// Admin / Admin Keuangan mereset PIN lingkungan: kembali ke PIN bawaan 123456 dan wajib diganti lagi
// (lingkungan memakai "Reset PIN": PIN lama 1x + PIN baru 2x). Admin tidak pernah melihat PIN yang dipilih lingkungan.
export default async function AdminPinPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; q?: string; st?: string }>;
}) {
  await requireBo();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const st = STATUS_PIN.some((s) => s.v === sp.st) ? sp.st! : "";

  const { data } = await db
    .from("lingkungan")
    .select("id,nama,aktif,pin_wajib_ganti,terkunci_sampai")
    .order("urutan")
    .order("nama");
  const sekarang = Date.now();

  const status = (l: any) =>
    l.terkunci_sampai && new Date(l.terkunci_sampai).getTime() > sekarang ? "terkunci"
    : l.pin_wajib_ganti ? "bawaan" : "diganti";

  const rows = (data ?? []).filter(
    (l) => (!q || l.nama.toLowerCase().includes(q.toLowerCase())) && (!st || status(l) === st)
  );
  const filtered = !!(q || st);

  return (
    <main className="wide">
      <div className="toolbar"><h1>PIN Lingkungan</h1></div>
      <Msg e={sp.e} />

      <form method="GET" className="card filters">
        <div className="f wide">
          <label htmlFor="q">Cari lingkungan</label>
          <input id="q" name="q" defaultValue={q} placeholder="Ketik nama…" />
        </div>
        <div className="f">
          <label htmlFor="st">Status PIN</label>
          <select id="st" name="st" defaultValue={st}>
            <option value="">Semua</option>
            {STATUS_PIN.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
        <div className="go">
          <button type="submit">Terapkan</button>
          {filtered && <Link href="/admin/pin" className="btn sec">Reset</Link>}
        </div>
      </form>

      <div className="card">
        <table>
          <thead><tr><th>Lingkungan / Wilayah</th><th>Status PIN</th><th></th></tr></thead>
          <tbody>
            {rows.map((l) => {
              const s = status(l);
              return (
                <tr key={l.id} style={{ opacity: l.aktif ? 1 : 0.6 }}>
                  <td>{l.nama}{!l.aktif && " (nonaktif)"}</td>
                  <td>
                    {s === "terkunci" ? <span className="badge RETURNED">Terkunci sementara</span>
                      : s === "bawaan" ? <span className="badge SUBMITTED">PIN bawaan (123456), belum diganti</span>
                      : <span className="badge APPROVED">Sudah diganti</span>}
                  </td>
                  <td>
                    <form action={resetPin}>
                      <input type="hidden" name="lingkungan" value={l.id} />
                      <ConfirmButton className="sec sm" message={`Reset PIN ${l.nama} ke 123456? Lingkungan ini harus menggantinya lagi saat masuk.`}>
                        Reset PIN
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="muted">{filtered ? "Tidak ada lingkungan yang cocok." : "Belum ada lingkungan."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">
        {rows.length} lingkungan. PIN awal semua lingkungan adalah 123456; tiap lingkungan wajib menggantinya sekali saat pertama masuk.
        Reset mengembalikan PIN ke 123456, mengeluarkan semua perangkat yang sedang masuk, dan membuka kunci bila terkunci.
        Setelah 5 kali salah, lingkungan terkunci 15 menit.
      </p>
    </main>
  );
}
