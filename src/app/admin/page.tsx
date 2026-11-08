import Link from "next/link";
import { db } from "@/lib/admin";
import { requireBo } from "@/lib/auth";
import { STATUS_LABEL, misaLabel, rp } from "@/lib/kolekte";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requireBo();
  const { data } = await db
    .from("kolekte_session")
    .select("id,tanggal,lingkungan,kategori,status,grand_total,misa(nama)")
    .order("tanggal", { ascending: false })
    .limit(200);

  // Antrean "Siap direview" di paling atas
  const rows = [...((data ?? []) as any[])].sort(
    (a, b) => Number(b.status === "READY_FOR_REVIEW") - Number(a.status === "READY_FOR_REVIEW")
  );

  return (
    <main className="wide">
      <div className="row">
        <h1>Sesi Kolekte</h1>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/admin/master/misa" className="btn sec">Master Misa</Link>
          <form action={logout}><button className="sec" type="submit">Keluar ({user.role === "ADMIN_KEUANGAN" ? "Admin Keuangan" : "Admin"})</button></form>
        </div>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Lingkungan</th><th>Misa</th><th>Status</th><th className="num">Total</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.tanggal}</td>
                <td>{s.lingkungan}</td>
                <td>{misaLabel(s.misa?.nama, s.kategori)}</td>
                <td><span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
                <td className="num">{rp(s.grand_total)}</td>
                <td><Link href={`/admin/${s.id}`}>Buka</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Belum ada sesi.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
