import { NextRequest } from "next/server";
import { checkExtensionToken } from "@/lib/apiauth";
import { readImage } from "@/lib/store";

/** Liefert ein gespeichertes Foto an Erweiterung/Worker (für den Upload zu Vinted). */
export async function GET(req: NextRequest) {
  if (!checkExtensionToken(req)) return new Response("unauthorized", { status: 401 });
  const path = req.nextUrl.searchParams.get("path") || "";
  if (!path.startsWith("listings/")) return new Response("forbidden", { status: 403 });
  try {
    const buf = readImage(path);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
