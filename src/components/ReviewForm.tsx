"use client";

import { useState, type ReactNode } from "react";

export type ReviewItem = { id: string; title: string; node: ReactNode };

// Checklist: tiap bagian dicentang; Approve baru aktif bila semua bagian sudah dicentang.
export default function ReviewForm(props: {
  action: (f: FormData) => void | Promise<void>;
  items: ReviewItem[];
  nama: string;
  tanggal: string;
  misa: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const ok = props.items;
  const all = ok.length > 0 && ok.every((i) => checked.has(i.id));
  const toggle = (id: string) =>
    setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <form action={props.action}>
      <input type="hidden" name="nama" value={props.nama} />
      <input type="hidden" name="tanggal" value={props.tanggal} />
      <input type="hidden" name="misa" value={props.misa} />
      {[...checked].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}

      <div className="row" style={{ marginBottom: 8 }}>
        <span className="muted">{checked.size} dari {ok.length} dicentang</span>
        <button type="button" className="sec" disabled={ok.length === 0}
          onClick={() => setChecked(all ? new Set() : new Set(ok.map((i) => i.id)))}>
          {all ? "Hapus semua centang" : "Centang semua"}
        </button>
      </div>

      {props.items.map((i) => (
        <div className="card" key={i.id}>
          <label style={{ margin: 0, color: "inherit", fontWeight: 600 }}>
            <input type="checkbox" checked={checked.has(i.id)} onChange={() => toggle(i.id)} />
            {i.title}
          </label>
          {i.node}
        </div>
      ))}

      <div className="actions">
        <button type="submit" className="ok" disabled={!all}>Approve ({checked.size})</button>
      </div>
    </form>
  );
}
