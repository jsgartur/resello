import { NextRequest, NextResponse } from "next/server";
import { read, write, id, now, saveImage, imageUrl } from "@/lib/store";

export async function GET() {
  const models = [...read().studio_models].reverse().map((m) => ({ ...m, url: imageUrl(m.path) }));
  return NextResponse.json({ models });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Kein Bild" }, { status: 400 });
  const path = saveImage(`models/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`, Buffer.from(await file.arrayBuffer()));
  const gender = (["m", "w", "x"].includes(String(form.get("gender"))) ? String(form.get("gender")) : "x") as "m" | "w" | "x";
  const model = { id: id(), name: String(form.get("name") || file.name), gender, path, created_at: now(), source: "upload" as const };
  write((d) => d.studio_models.push(model));
  return NextResponse.json({ model: { ...model, url: imageUrl(path) } });
}
