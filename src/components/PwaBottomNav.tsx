"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { keluar } from "@/app/actions";

const ikon = {
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
  hasil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-6M3 20h18" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  keluar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
};

// Menu bawah PWA (seperti aplikasi seluler): Review, Hasil, Ganti PIN, Keluar.
// Selama PIN masih bawaan (wajib Reset PIN), hanya Reset PIN dan Keluar yang ditampilkan.
// Tidak tampil di halaman masuk dan Back Office.
export default function PwaBottomNav({ wajibGanti }: { wajibGanti: boolean }) {
  const path = usePathname();
  if (path === "/masuk" || path.startsWith("/admin")) return null;

  const tabs = wajibGanti
    ? [{ href: "/pin", label: "Reset PIN", icon: ikon.pin }]
    : [
        { href: "/review", label: "Review", icon: ikon.review },
        { href: "/hasil", label: "Hasil", icon: ikon.hasil },
        { href: "/pin", label: "Ganti PIN", icon: ikon.pin },
      ];

  return (
    <>
      <div className="bottom-nav-spacer" />
      <nav className="bottom-nav" aria-label="Menu utama">
        {tabs.map((t) => {
          const aktif = path === t.href || path.startsWith(t.href + "/");
          return (
            <Link key={t.href} href={t.href} className={aktif ? "active" : undefined} aria-current={aktif ? "page" : undefined}>
              {t.icon}
              <span>{t.label}</span>
            </Link>
          );
        })}
        <form action={keluar}>
          <button type="submit" className="tab">
            {ikon.keluar}
            <span>Keluar</span>
          </button>
        </form>
      </nav>
    </>
  );
}
