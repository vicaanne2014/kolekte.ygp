import { rp } from "@/lib/kolekte";

export type RekapData = { tipe: string; label: string; lines: { nilai: number; qty: number }[] };

// Rekap per pecahan, DIPISAH per kantong (Merah, Kuning, Parkir, Intensi), tidak digabung.
export default function RekapKantong({ data }: { data: RekapData[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
      {data.map(({ tipe, label, lines }) => {
        const sorted = [...lines].sort((a, b) => b.nilai - a.nilai);
        const total = sorted.reduce((t, l) => t + l.nilai * l.qty, 0);
        return (
          <div className="card" key={tipe} style={{ marginBottom: 0 }}>
            <h2 style={{ marginTop: 0 }}>Rekap {label}</h2>
            {sorted.length === 0 ? (
              <p className="muted">Belum ada isian.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Pecahan</th><th className="num">Jumlah</th><th className="num">Nilai</th></tr>
                </thead>
                <tbody>
                  {sorted.map((l) => (
                    <tr key={l.nilai}>
                      <td>{rp(l.nilai)}</td><td className="num">{l.qty}</td><td className="num">{rp(l.nilai * l.qty)}</td>
                    </tr>
                  ))}
                  <tr className="total"><td colSpan={2}>Total {label}</td><td className="num">{rp(total)}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
