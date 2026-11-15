import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Resello – Vinted Cockpit",
  applicationName: "Resello",
  icons: { icon: "/favicon.png", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "Resello", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b0d0e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
