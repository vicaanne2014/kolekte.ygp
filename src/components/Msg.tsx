import { errMsg } from "@/lib/kolekte";

// Pesan galat di dalam halaman. Pesan berhasil ditampilkan sebagai pop-up oleh <Toast /> (parameter ok diabaikan di sini).
export default function Msg({ e }: { e?: string; ok?: string }) {
  if (e) return <div className="err">{errMsg(e)}</div>;
  return null;
}
