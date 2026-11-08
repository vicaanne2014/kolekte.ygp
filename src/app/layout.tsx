import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import Toast from "@/components/Toast";
import PwaBottomNav from "@/components/PwaBottomNav";
import { getPwaSession } from "@/lib/pwa-auth";

export const metadata: Metadata = {
  title: "Kolekte",
  description: "Pencatatan hasil kolekte Paroki Santo Yohanes Gabriel Perboyre",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17462b" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pwa = await getPwaSession(); // ada = sudah masuk lewat PIN -> tampilkan menu bawah
  return (
    <html lang="id">
      <body>
        <SiteHeader />
        {children}
        {pwa && <PwaBottomNav wajibGanti={pwa.wajibGanti} />}
        <Suspense fallback={null}>
          <Toast />
        </Suspense>
      </body>
    </html>
  );
}
