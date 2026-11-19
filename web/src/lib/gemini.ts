import "server-only";
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
function client() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY fehlt in .env");
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

export type InputImage = { data: Buffer; mimeType: string };

export type StudioTool = "tryon" | "background" | "flatlay" | "enhance" | "custom";

export type StudioOptions = {
  tool: StudioTool;
  garments: InputImage[];
  model?: InputImage | null;
  background?: "white" | "studio" | "street" | "transparent";
  flatlayStyle?: "wood" | "marble" | "linen" | "concrete" | "minimal";
  topFit?: "original" | "oversized" | "regular" | "slim";
  pantsFit?: "original" | "baggy" | "straight" | "slim";
  wear?: "auto" | "set" | "top" | "bottom";
  hint?: string;
  custom?: string;
};

const QUALITY =
  "Photorealistic, natural lighting, sharp focus, true-to-life colors. Keep every detail of the garment exactly as in the product photos: logos, prints, stitching, texture, color, wear marks. Do not invent or remove logos or text. Portrait format 4:5.";

export function buildPrompt(o: StudioOptions) {
  switch (o.tool) {
    case "tryon": {
      const fit = [
        o.topFit && o.topFit !== "original" ? `The top should have a ${o.topFit} fit.` : "",
        o.pantsFit && o.pantsFit !== "original" ? `The pants should have a ${o.pantsFit} fit.` : "",
      ].filter(Boolean).join(" ");
      const wear = {
        auto: "First identify EVERY garment shown in the product photos (for example a jacket AND matching pants of a tracksuit set). The person must wear ALL of these garments at the same time – never leave one out and never replace one with a different garment.",
        set: "The product photos show a SET (e.g. tracksuit jacket + pants). The person must wear BOTH the top and the bottom from the photos at the same time. The jacket is worn on the upper body (zipped up or slightly open).",
        top: "Only the TOP / JACKET from the product photos is worn. Combine it with plain, simple dark jeans.",
        bottom: "Only the PANTS / BOTTOM from the product photos are worn. Combine them with a plain white t-shirt.",
      }[o.wear ?? "auto"];
      const rules = `${wear} Reproduce each garment exactly: same color, fabric, stripes, logos, crests, zips and details as in the photos. Do not add garments or accessories that are not in the photos, except plain shoes${o.wear === "top" || o.wear === "bottom" ? " and the neutral basic mentioned above" : ""}. ${o.hint ? `Note from the seller: ${o.hint}.` : ""} ${fit}`;
      return o.model
        ? `The LAST image shows a person (the model). All other images are product photos of clothing. Dress the model in the clothing from the product photos, replacing what they currently wear on the corresponding body parts. ${rules} Keep the model's face, body, pose, hands, background and lighting unchanged. ${QUALITY}`
        : `All images are product photos of clothing. Create a casual, authentic secondhand-marketplace "fit pic": a mirror selfie of a person wearing the clothing, full body from neck to shoes visible, neutral bright indoor background, face hidden by the phone or cropped. ${rules} ${QUALITY}`;
    }
    case "background": {
      const bg = {
        white: "a clean pure white background",
        studio: "a soft light-grey photo studio background with subtle shadow",
        street: "a softly blurred urban street background",
        transparent: "a plain white background (it will be cut out later)",
      }[o.background ?? "white"];
      return `Isolate the clothing item from the image and place it on ${bg}. Keep the garment's shape, wrinkles and details exactly. ${QUALITY}`;
    }
    case "flatlay": {
      const surface = {
        wood: "a light oak wooden floor",
        marble: "white marble",
        linen: "a beige linen sheet",
        concrete: "smooth grey concrete",
        minimal: "a plain off-white surface",
      }[o.flatlayStyle ?? "minimal"];
      return `Create a top-down flatlay product photo of the clothing item(s), neatly laid out and smoothed on ${surface}, soft daylight from a window, subtle natural shadows, nothing else in the frame. ${QUALITY}`;
    }
    case "enhance":
      return `Improve this product photo: remove wrinkles as if freshly ironed, fix exposure and white balance, increase sharpness and detail. Do not change the garment, its color, the background composition or framing. ${QUALITY}`;
    case "custom":
      return `${o.custom ?? ""}\n\n${QUALITY}`;
  }
}

/** Erzeugt ein Bild mit Gemini. Gibt PNG/JPEG-Buffer zurück. */
export async function generateStudioImage(o: StudioOptions): Promise<{ data: Buffer; mimeType: string; prompt: string }> {
  const prompt = buildPrompt(o);
  const images = [...o.garments, ...(o.model ? [o.model] : [])];
  const res = await client().models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [
          ...images.map((img) => ({ inlineData: { data: img.data.toString("base64"), mimeType: img.mimeType } })),
          { text: prompt },
        ],
      },
    ],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });

  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img?.inlineData?.data) {
    const text = parts.map((p) => p.text).filter(Boolean).join(" ");
    throw new Error(`Gemini hat kein Bild geliefert${text ? `: ${text}` : ""}`);
  }
  return { data: Buffer.from(img.inlineData.data, "base64"), mimeType: img.inlineData.mimeType || "image/png", prompt };
}

/** Text-Generierung (Antwortentwürfe, Beschreibungen). */
export async function generateText(prompt: string, system?: string) {
  const res = await client().models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
    contents: prompt,
    config: system ? { systemInstruction: system } : undefined,
  });
  return (res.text ?? "").trim();
}

/** Erzeugt ein erfundenes Model-Foto (Fitpic-Stil) für die Try-on-Galerie. */
export async function generateModelImage(gender: "m" | "w", variant: number) {
  const looks = gender === "m"
    ? ["slim young man, plain white t-shirt and plain grey sweatpants", "athletic man, plain black t-shirt and dark straight jeans", "young man, plain grey hoodie and light baggy jeans", "tall man, plain navy t-shirt and beige chinos", "young man, plain white tank top and black cargo pants", "man with curly hair, plain olive t-shirt and blue jeans"]
    : ["slim young woman, plain white fitted t-shirt and light straight jeans", "young woman, plain black top and dark wide-leg jeans", "woman, plain grey crop hoodie and beige sweatpants", "tall woman, plain beige t-shirt and blue mom jeans", "young woman, plain white tank top and black trousers", "woman with long hair, plain olive top and light baggy jeans"];
  const scenes = ["mirror selfie in a bright minimal bedroom", "standing in front of a white wall", "on a quiet city sidewalk, daylight", "in a hallway with wooden floor", "in front of a clothing rack, soft daylight", "outdoors next to a parked car, overcast light"];
  const prompt = `Photorealistic casual secondhand-marketplace "fit pic" of a fictional ${looks[variant % looks.length]}, ${scenes[Math.floor(variant / looks.length) % scenes.length]}. Full body from neck to shoes visible, face out of frame or hidden by the phone. Neutral standing pose, arms slightly away from the body so clothing is clearly visible. Natural smartphone photo look, sharp focus, portrait format 3:4. Plain clothes without logos or text. Not a real person.`;
  const res = await client().models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
    contents: prompt,
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });
  const part = (res.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini hat kein Bild geliefert");
  return { data: Buffer.from(part.inlineData.data, "base64"), mimeType: part.inlineData.mimeType || "image/png" };
}
