import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Baustellenkontrolle", template: "%s · Baustellenkontrolle" },
  description: "Baustellenkontrollen durchführen, Abweichungen bewerten und Berichte erstellen – tozzo gruppe ag",
  applicationName: "Baustellenkontrolle",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kontrolle", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de-CH" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
