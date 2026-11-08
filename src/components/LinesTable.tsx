import { rp } from "@/lib/kolekte";

export type ReadLine = { nilai: number; qty: number; nilai_baris: number };

// Tabel baca-saja, pecahan menurun.
export default function LinesTable({ lines }: { lines: ReadLine[] }) {
  if (lines.length === 0) return <p className="muted">Tidak ada isian (kosong).</p>;
  const sorted = [...lines].sort((a, b) => b.nilai - a.nilai);
  return (
    <table>
      <thead><tr><th>Pecahan</th><th className="num">Jumlah</th><th className="num">Nilai</th></tr></thead>
      <tbody>
        {sorted.map((l) => (
          <tr key={l.nilai}>
            <td>{rp(l.nilai)}</td><td className="num">{l.qty}</td><td className="num">{rp(l.nilai_baris)}</td>
          </tr>
        ))}
        <tr className="total">
          <td colSpan={2}>Subtotal</td>
          <td className="num">{rp(sorted.reduce((s, l) => s + Number(l.nilai_baris), 0))}</td>
        </tr>
      </tbody>
    </table>
  );
}
