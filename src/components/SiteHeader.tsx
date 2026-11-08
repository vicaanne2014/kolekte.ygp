"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Header PWA dengan logo paroki. Back Office memakai sidebar sendiri, jadi header ini disembunyikan di /admin.
export default function SiteHeader() {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  return (
    <header className="site-header">
      <Link href="/" className="inner" aria-label="Beranda Kolekte">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Logo Paroki Santo Yohanes Gabriel Perboyre" />
        <div className="t">
          <strong>Kolekte</strong>
          <span>Paroki Santo Yohanes Gabriel Perboyre</span>
        </div>
      </Link>
    </header>
  );
}
