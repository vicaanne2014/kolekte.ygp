"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; aktif: (p: string) => boolean };
type Group = { judul: string; items: Item[] };

const GROUPS: Group[] = [
  {
    judul: "Kolekte",
    items: [
      { href: "/admin", label: "Sesi Kolekte", aktif: (p) => p === "/admin" || /^\/admin\/[0-9a-f-]{36}/.test(p) },
    ],
  },
  {
    judul: "Master Data",
    items: [
      { href: "/admin/master/lingkungan", label: "Lingkungan / Wilayah", aktif: (p) => p.startsWith("/admin/master/lingkungan") },
      { href: "/admin/master/misa", label: "Misa", aktif: (p) => p.startsWith("/admin/master/misa") },
    ],
  },
  {
    judul: "Keamanan",
    items: [{ href: "/admin/pin", label: "PIN Lingkungan", aktif: (p) => p.startsWith("/admin/pin") }],
  },
];

// Navigasi Back Office: hanya lewat sidebar ini.
export default function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Menu Back Office">
      {GROUPS.map((g) => (
        <div key={g.judul} style={{ display: "contents" }}>
          <div className="grp">{g.judul}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={i.aktif(path) ? "active" : undefined}>
              {i.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
