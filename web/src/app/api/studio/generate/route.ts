import { NextRequest, NextResponse } from "next/server";
import { read, write, id, now, saveImage, readImage, imageUrl } from "@/lib/store";
import { generateStudioImage, InputImage, StudioOptions, StudioTool } from "@/lib/gemini";

export const maxDuration = 120;

const TOOLS: StudioTool[] = ["tryon", "background", "flatlay", "enhance", "custom"];
const ext = (mime: string) => (mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg");

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const tool = String(form.get("tool")) as StudioTool;
    if (!TOOLS.includes(tool)) return NextResponse.json({ error: "Unbekanntes Tool" }, { status: 400 });

    const files = form.getAll("garments").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
    if (!files.length) return NextResponse.json({ error: "Bitte mindestens ein Foto hochladen" }, { status: 400 });

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const garments: InputImage[] = [];
    const inputPaths: string[] = [];
    for (const [i, f] of files.entries()) {
      const data = Buffer.from(await f.arrayBuffer());
      garments.push({ data, mimeType: f.type || "image/jpeg" });
      inputPaths.push(saveImage(`eingaben/${stamp}-${i}.${ext(f.type)}`, data));
    }

    // Model: gespeichertes Model oder keins (KI erzeugt Person)
    let model: InputImage | null = null;
    const modelId = form.get("model_id");
    if (tool === "tryon" && modelId) {
      const m = read().studio_models.find((x) => x.id === String(modelId));
      if (m) model = { data: readImage(m.path), mimeType: m.path.endsWith(".png") ? "image/png" : m.path.endsWith(".webp") ? "image/webp" : "image/jpeg" };
    }

    const opts: StudioOptions = {
      tool, garments, model,
      background: (form.get("background") as StudioOptions["background"]) || undefined,
      flatlayStyle: (form.get("flatlayStyle") as StudioOptions["flatlayStyle"]) || undefined,
      topFit: (form.get("topFit") as StudioOptions["topFit"]) || undefined,
      pantsFit: (form.get("pantsFit") as StudioOptions["pantsFit"]) || undefined,
      custom: String(form.get("custom") || ""),
    };

    const result = await generateStudioImage(opts);
    const outPath = saveImage(`ergebnisse/${stamp}.${ext(result.mimeType)}`, result.data);
    const imageId = id();
    write((d) => d.studio_images.push({ id: imageId, tool, prompt: result.prompt, input_paths: inputPaths, output_path: outPath, created_at: now() }));

    return NextResponse.json({ id: imageId, url: imageUrl(outPath), input: imageUrl(inputPaths[0]) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fehler" }, { status: 500 });
  }
}
