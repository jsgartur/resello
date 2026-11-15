import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Resello – Vinted Cockpit",
    short_name: "Resello",
    description: "Dein Vinted-Cockpit: Angebote, Postfach, Automationen, Bildstudio",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f0f10",
    theme_color: "#0f0f10",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
