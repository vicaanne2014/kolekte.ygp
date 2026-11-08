import { getBoUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import AdminNav from "@/components/AdminNav";

// Back Office: sidebar sebagai satu-satunya navigasi. Halaman login (belum masuk) tampil tanpa sidebar.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getBoUser();
  if (!user) return <>{children}</>;

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo Paroki Santo Yohanes Gabriel Perboyre" />
          <div className="t">
            <strong>Kolekte</strong>
            <span>Back Office</span>
          </div>
        </div>

        <AdminNav />

        <div className="user">
          <div className="who">{user.email}</div>
          <div className="role">{user.role === "ADMIN_KEUANGAN" ? "Admin Keuangan" : "Admin"}</div>
          <form action={logout}><button type="submit">Keluar</button></form>
        </div>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
