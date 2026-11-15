import { NextRequest, NextResponse } from "next/server";
import { read, write, id, now, saveImage, imageUrl } from "@/lib/store";
import { generateModelImage } from "@/lib/gemini";

export const maxDuration = 120;

/** Erzeugt EIN KI-Model (der Browser ruft das mehrfach auf, um die Galerie zu füllen). */
export async function POST(req: NextRequest) {
  try {
    const { gender } = await req.json();
    const g: "m" | "w" = gender === "w" ? "w" : "m";
    const existing = read().studio_models.filter((m) => m.source === "ki" && m.gender === g).length;
    const img = await generateModelImage(g, existing);
    const path = saveImage(`models/ki-${g}-${Date.now()}.${img.mimeType.includes("png") ? "png" : "jpg"}`, img.data);
    const model = { id: id(), name: `${g === "m" ? "Men" : "Women"} fitpic ${String(existing + 1).padStart(3, "0")}`, gender: g, path, created_at: now(), source: "ki" as const };
    write((d) => d.studio_models.push(model));
    return NextResponse.json({ model: { ...model, url: imageUrl(path) } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fehler" }, { status: 500 });
  }
}
