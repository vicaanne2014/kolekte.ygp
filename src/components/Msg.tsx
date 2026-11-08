import { errMsg } from "@/lib/kolekte";

export default function Msg({ e, ok }: { e?: string; ok?: string }) {
  if (e) return <div className="err">{errMsg(e)}</div>;
  if (ok) return <div className="okmsg">Tersimpan.</div>;
  return null;
}
