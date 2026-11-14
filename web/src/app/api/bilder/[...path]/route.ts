import { NextRequest } from "next/server";
import { readImage } from "@/lib/store";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

// Liefert Bilder aus data/bilder aus (durch Login geschützt)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.join("/");
  try {
    const buf = readImage(rel);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": TYPES[rel.split(".").pop()!.toLowerCase()] ?? "application/octet-stream", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response("Nicht gefunden", { status: 404 });
  }
}
