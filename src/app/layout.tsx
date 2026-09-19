import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solibook — Gestión Administrativa Solí Deo",
  description: "Sistema oficial de gestión administrativa exclusiva para el Ministerio Vocal Solí Deo.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  }
};

export const viewport: Viewport = {
  themeColor: "#0099DD",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-[#f8fafc] text-slate-800 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
