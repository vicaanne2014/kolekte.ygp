"use client";

import { useState } from "react";
import NameField from "./NameField";
import { PECAHAN, rp } from "@/lib/kolekte";

// Formulir pecahan × qty. Dipakai pembuat (simpan/submit) dan pereview (edit sebelum approve).
export default function SectionForm(props: {
  action: (f: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  reviewer?: boolean;
  initial: Record<number, number>; // nilai pecahan -> qty
  isEmpty: boolean;
}) {
  const [qty, setQty] = useState<Record<number, string>>(
    Object.fromEntries(Object.entries(props.initial).map(([k, v]) => [k, String(v)]))
  );
  const [kosong, setKosong] = useState(props.isEmpty);
  const n = (nilai: number) => parseInt(qty[nilai] ?? "", 10) || 0;
  const total = PECAHAN.reduce((s, nilai) => s + nilai * n(nilai), 0);

  return (
    <form action={props.action}>
      {Object.entries(props.hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="card">
        <table>
          <tbody>
            {PECAHAN.map((nilai) => (
              <tr key={nilai}>
                <td>{rp(nilai)}</td>
                <td style={{ width: 110 }}>
                  <input
                    name={`qty__${nilai}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    disabled={kosong}
                    value={qty[nilai] ?? ""}
                    onChange={(e) => setQty({ ...qty, [nilai]: e.target.value.replace(/\D/g, "") })}
                  />
                </td>
                <td className="num muted">{rp(nilai * n(nilai))}</td>
              </tr>
            ))}
            <tr className="total"><td colSpan={2}>Total</td><td className="num">{rp(kosong ? 0 : total)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <label style={{ margin: 0 }}>
          <input type="checkbox" name="kosong" checked={kosong} onChange={(e) => setKosong(e.target.checked)} />
          Kosong (tidak ada isian)
        </label>
        {!props.reviewer && <NameField label="Nama Anda (pembuat)" />}
      </div>

      <div className="actions">
        {props.reviewer ? (
          <button type="submit">Simpan Perubahan</button>
        ) : (
          <>
            <button type="submit" name="intent" value="save" className="sec">Simpan Draft</button>
            <button type="submit" name="intent" value="submit">Submit untuk Review</button>
          </>
        )}
      </div>
    </form>
  );
}
