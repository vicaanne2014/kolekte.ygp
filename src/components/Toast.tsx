"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { OK_MESSAGES } from "@/lib/kolekte";

// Notifikasi (toast) di PWA dan Back Office. Setelah suatu perubahan berhasil, aksi server mengarahkan ke
// halaman dengan ?ok=<kode>; komponen ini menampilkannya sebagai pop-up lalu menghapus ?ok dari alamat
// supaya tidak muncul lagi saat halaman dimuat ulang. Pesan galat tetap tampil di dalam halaman (Msg).
export default function Toast() {
  const sp = useSearchParams();
  const path = usePathname();
  const ok = sp.get("ok");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ok) return;
    const teks = OK_MESSAGES[ok];
    if (teks) setMsg(teks);
    const p = new URLSearchParams(sp.toString());
    p.delete("ok");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${path}?${qs}` : path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4500);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{msg}</span>
      <button type="button" onClick={() => setMsg(null)} aria-label="Tutup notifikasi">×</button>
    </div>
  );
}
