import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
