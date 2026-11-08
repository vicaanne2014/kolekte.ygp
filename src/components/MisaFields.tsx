"use client";

import { useState } from "react";
import { KATEGORI_MISA } from "@/lib/kolekte";

type Misa = { id: string; nama: string; jenis: string };

// Pilih Misa (master data). Misa berjenis MINGGU meminta kategori (Sabtu Sore / Minggu 1 / Minggu 2);
// misa berjenis JUMAT_PERTAMA hanya satu misa, jadi tanpa kategori.
export default function MisaFields({ misas }: { misas: Misa[] }) {
  const [id, setId] = useState("");
  const pakaiKategori = misas.find((m) => m.id === id)?.jenis === "MINGGU";

  return (
    <>
      <label htmlFor="misa">Misa</label>
      <select id="misa" name="misa" required value={id} onChange={(e) => setId(e.target.value)}>
        <option value="" disabled>Pilih misa…</option>
        {misas.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
      </select>

      {pakaiKategori && (
        <>
          <label htmlFor="kategori">Sabtu Sore / Minggu 1 / Minggu 2</label>
          <select id="kategori" name="kategori" required defaultValue="">
            <option value="" disabled>Pilih…</option>
            {KATEGORI_MISA.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
          </select>
        </>
      )}
    </>
  );
}
