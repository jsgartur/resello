import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Resello – Vinted Cockpit" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
