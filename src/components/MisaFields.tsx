"use client";

import { useState } from "react";
import { BULAN } from "@/lib/kolekte";

type Misa = { id: string; nama: string; pilih_bulan: boolean };

// Pilih Misa (master data). Bila misa meminta bulan (Jumat Pertama), tampilkan pilihan bulan 1–12.
export default function MisaFields({
  misas, defaultMisa, defaultBulan,
}: { misas: Misa[]; defaultMisa?: string; defaultBulan: number }) {
  const [id, setId] = useState(defaultMisa ?? "");
  const pilihBulan = misas.find((m) => m.id === id)?.pilih_bulan ?? false;
  return (
    <>
      <label htmlFor="misa">Misa</label>
      <select id="misa" name="misa" required value={id} onChange={(e) => setId(e.target.value)}>
        <option value="" disabled>Pilih misa…</option>
        {misas.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
      </select>
      {pilihBulan && (
        <>
          <label htmlFor="bulan">Bulan</label>
          <select id="bulan" name="bulan" required defaultValue={defaultBulan}>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{i + 1} — {b}</option>)}
          </select>
        </>
      )}
    </>
  );
}
