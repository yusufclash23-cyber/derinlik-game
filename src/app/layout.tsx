import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DERİNLİK — Her kazı yeni bir tehlikeyi açığa çıkarır",
  description: "3D madencilik, keşif ve hayatta kalma oyunu. Geliştirici: Yusuf SERTKAYA.",
  manifest: "/manifest.webmanifest",
  applicationName: "DERİNLİK",
  appleWebApp: { capable: true, title: "DERİNLİK", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-512.png" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#0a0c18", viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-[#0a0c18] text-white antialiased">{children}</body>
    </html>
  );
}
