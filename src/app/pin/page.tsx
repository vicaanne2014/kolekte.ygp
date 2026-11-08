import Link from "next/link";
import { requirePwa } from "@/lib/pwa-auth";
import { gantiPin } from "../actions";
import Msg from "@/components/Msg";

export const dynamic = "force-dynamic";

const PIN_INPUT = {
  type: "password",
  inputMode: "numeric" as const,
  pattern: "[0-9]{6}",
  minLength: 6,
  maxLength: 6,
  required: true,
  autoComplete: "off",
  placeholder: "6 angka",
};

// Satu formulir untuk dua keadaan:
//  - PIN masih bawaan (123456): judul "Reset PIN", wajib dilakukan sekali sebelum memakai aplikasi.
//  - Sudah diganti: judul "Ganti PIN".
// Isian sama: PIN lama 1x, PIN baru 2x (diulang).
export default async function PinPage({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const me = await requirePwa({ allowGanti: true });
  const { e, ok } = await searchParams;
  const reset = me.wajibGanti;

  return (
    <main>
      {!reset && <p><Link href="/">← Kembali</Link></p>}
      <h1>{reset ? "Reset PIN" : "Ganti PIN"}</h1>
      <div className="muted" style={{ marginBottom: 12 }}>{me.nama}</div>
      {reset && (
        <div className="err">
          PIN Anda masih PIN bawaan (123456). Reset PIN dulu sebelum memakai aplikasi. Ini hanya sekali di awal.
        </div>
      )}
      <Msg e={e} ok={ok} />
      <form action={gantiPin} className="card">
        <label htmlFor="pin_lama">PIN lama{reset ? " (123456)" : ""}</label>
        <input id="pin_lama" name="pin_lama" {...PIN_INPUT} />
        <label htmlFor="pin_baru">PIN baru</label>
        <input id="pin_baru" name="pin_baru" {...PIN_INPUT} />
        <label htmlFor="pin_ulang">Ulangi PIN baru</label>
        <input id="pin_ulang" name="pin_ulang" {...PIN_INPUT} />
        <div className="actions"><button type="submit">{reset ? "Reset PIN" : "Simpan PIN"}</button></div>
      </form>
      <p className="muted">
        {reset
          ? "Setelah ini tombolnya berubah menjadi Ganti PIN. Pilih PIN selain 123456."
          : "Setelah PIN diganti, perangkat lain yang sedang masuk akan diminta masuk lagi."}
      </p>
    </main>
  );
}
