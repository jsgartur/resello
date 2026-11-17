import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { IMAGE_DIR, saveImage, imageUrl } from "@/lib/store";

/** Eigene Maße-Vorlagen (Hose/Jacke) – Standard-Hose liegt in /public/masse */
export async function GET() {
  const has = (k: string) => fs.existsSync(path.join(IMAGE_DIR, `masse/${k}.png`));
  return NextResponse.json({
    hose: has("hose") ? imageUrl("masse/hose.png") : "/masse/hose.png",
    jacke: has("jacke") ? imageUrl("masse/jacke.png") : null,
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const kind = form.get("kind") === "jacke" ? "jacke" : "hose";
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  saveImage(`masse/${kind}.png`, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: imageUrl(`masse/${kind}.png`) + `?v=${Date.now()}` });
}
