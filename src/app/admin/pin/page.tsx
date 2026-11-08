import Link from "next/link";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { resetPin } from "../../actions";
import ConfirmButton from "@/components/ConfirmButton";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

// Admin / Admin Keuangan mereset PIN lingkungan: kembali ke PIN bawaan 123456 dan wajib diganti lagi
// (lingkungan memakai "Reset PIN": PIN lama 1x + PIN baru 2x). Admin tidak pernah melihat PIN yang dipilih lingkungan.
export default async function AdminPinPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await requireBo();
  const { e } = await searchParams;

  const { data: daftar } = await db
    .from("lingkungan")
    .select("id,nama,aktif,pin_wajib_ganti,terkunci_sampai")
    .order("urutan")
    .order("nama");
  const sekarang = Date.now();

  return (
    <main className="wide">
      <p><Link href="/admin">← Daftar sesi</Link></p>
      <h1>PIN Lingkungan</h1>
      <Msg e={e} />
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Lingkungan / Wilayah</th><th>Status PIN</th><th></th></tr></thead>
          <tbody>
            {daftar?.map((l) => {
              const terkunci = l.terkunci_sampai && new Date(l.terkunci_sampai).getTime() > sekarang;
              return (
                <tr key={l.id} style={{ opacity: l.aktif ? 1 : 0.55 }}>
                  <td>{l.nama}{!l.aktif && " (nonaktif)"}</td>
                  <td>
                    {terkunci ? <span className="badge RETURNED">Terkunci sementara</span>
                      : l.pin_wajib_ganti ? <span className="badge SUBMITTED">PIN bawaan (123456), belum diganti</span>
                      : <span className="badge APPROVED">Sudah diganti</span>}
                  </td>
                  <td>
                    <form action={resetPin}>
                      <input type="hidden" name="lingkungan" value={l.id} />
                      <ConfirmButton className="sec" message={`Reset PIN ${l.nama} ke 123456? Lingkungan ini harus menggantinya lagi saat masuk.`}>
                        Reset PIN
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        PIN awal semua lingkungan adalah 123456; tiap lingkungan wajib menggantinya sekali saat pertama masuk.
        Reset mengembalikan PIN ke 123456, mengeluarkan semua perangkat yang sedang masuk, dan membuka kunci bila terkunci.
        Setelah 5 kali salah, lingkungan terkunci 15 menit.
      </p>
    </main>
  );
}
