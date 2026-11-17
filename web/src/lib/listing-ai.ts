import "server-only";
import { GoogleGenAI } from "@google/genai";

// Stil-Vorlage aus deinem Listing-Generator
const EXAMPLE = {
  title: "Vintage Y2K 2000s AC Milan Adidas Tracksuit Trainingsanzug Retro Schwarz Rot Größe M Sehr gut",
  description: "🔥 Vintage AC Milan Tracksuit im klassischen Y2K Football-/Soccer-Style\n⚽ Originaler AC Milan Look mit Adidas Details & bwin Sponsor\n🧥 Jacke + Hose (Open leg) als komplettes Set\n📏 Größe M\n✨ Sehr guter Zustand – insgesamt sehr gepflegt, keine größeren Mängel\n\nSchwarzes Design mit markanten roten Details, Adidas 3-Stripes und AC Milan Wappen. Perfekt für einen Vintage Football-, Y2K- oder Streetwear-Look.\n\nIdeal für Sammler, AC Milan Fans oder als besonderer Vintage Tracksuit 🔥\n\n📦 Schneller Versand\n💬 Bei Fragen oder weiteren Maßen gerne schreiben",
  hashtags: ["ACMilan","Milan","Adidas","Tracksuit","Trainingsanzug","Trainingsset","Fußball","Soccer","Football","Vintage","Y2K","Retro","Streetwear","Fußballbekleidung","Sportbekleidung","VintageFußball","Oldschool","90sStyle","2000sStyle","Completo","Tuta","TutaSportiva","AbbigliamentoCalcio","Calcio","ModaVintage","StileY2K","Survetement","EnsembleSport","TenueFootball","VêtementVintage","StyleY2K","ModeVintage","Trainingspak","Sportpak","Voetbal","Voetbalkleding","VintageKleding","Y2KStyle","RetroKleding","Straatmode","openleg","pashanim","pashanimstyle"],
};

const STYLE_REF = `TITEL: ${EXAMPLE.title}\n\nBESCHREIBUNG:\n${EXAMPLE.description}\n\n${EXAMPLE.hashtags.map((h) => "#" + h).join(" ")}`;

export type GeneratedListing = {
  title: string; brand: string; size: string; condition: string; colors: string[]; category: string;
  price: { suggested: number; low: number; high: number }; description: string; hashtags: string[]; unsure: string[];
};

function buildPrompt({ size, cond, notes, count }: { size: string; cond: string; notes: string; count: number }) {
  return `Du bist ein erfahrener Vinted-Reseller in Deutschland (Vintage, Y2K, Sportswear, Streetwear). Auf den ${count} Fotos ist EIN Artikel, den ich verkaufen will. Erstelle daraus ein verkaufsstarkes Vinted-Listing auf Deutsch – exakt im Stil meines Referenz-Listings unten.

MEINE ANGABEN (haben Vorrang vor dem, was du siehst):
- Größe: ${size || "nicht angegeben – vom Etikett ablesen; wenn nicht lesbar, Größe komplett weglassen"}
- Zustand: ${cond || "nicht angegeben – aus den Fotos einschätzen (Vinted-Stufen: Neu mit Etikett, Neu ohne Etikett, Sehr gut, Gut, Zufriedenstellend)"}
- Notizen: ${notes || "keine"}

REGELN
1. Titel: Aufbau wie Referenz – [Vintage] [Ära wie Y2K/2000s/90s, nur wenn plausibel] [Team/Kollektion] [Marke] [Artikel Englisch] [Artikel Deutsch] [Stilwort wie Retro] [Farben Deutsch] Größe [X] [Zustand]. Keywords, die Käufer suchen. Keine Emojis, keine Satzzeichen, max. ca. 100 Zeichen.
2. Beschreibung: gleiche Struktur wie Referenz – 5 Zeilen mit passenden Emojis (🔥 Aufhänger, 1 Zeile zu Details/Logos/Sponsor, 1 Zeile was dabei ist bzw. Schnitt/Material, 📏 Größe, ✨ Zustand), dann ein Absatz zu Design/Farben/Details und Style, dann eine Zeile für wen es ideal ist, dann "📦 Schneller Versand" und "💬 Bei Fragen oder weiteren Maßen gerne schreiben". Mängel aus meinen Notizen ehrlich erwähnen. KEINE Hashtags in die Beschreibung.
3. Erfinde nichts: Marke, Team, Sponsor, Ära und Material nur nennen, wenn auf den Fotos erkennbar (z. B. Etikett). Material nie raten. Alles Unsichere kurz in "unsure" auflisten. Kein "original"/"echt", wenn Echtheit nicht erkennbar ist. Ist die Größe nicht erkennbar: "size" leer lassen und "Größe …" im Titel sowie die 📏-Zeile weglassen – niemals Platzhalter wie "unsure" oder "unbekannt" schreiben.
4. Hashtags: 40–55 Stück ohne "#", keine Leerzeichen. Mix aus Marke/Team, Artikel (DE+EN), Stil (Vintage, Y2K, Retro, Streetwear …), dann Italienisch, Französisch und Niederländisch, plus passende Trend-/Szene-Tags nur wenn sie zum Artikel passen.
5. Preis: realistischer Vinted-Verkaufspreis in Euro für Deutschland (suggested, low, high).
6. Farben auf Deutsch, Vinted-Farbnamen (Schwarz, Weiß, Grau, Blau, Marineblau, Rot, Grün, Gelb, Beige, Braun, Rosa, Lila, Orange, Bunt …).

REFERENZ-LISTING (Stil, Länge und Tonfall genau so):
${STYLE_REF}

Antworte NUR mit JSON in genau dieser Form:
{"title":"…","brand":"…","size":"…","condition":"…","colors":["…"],"category":"…","price":{"suggested":0,"low":0,"high":0},"description":"…","hashtags":["…"],"unsure":["…"]}`;
}

function parseJson(text: string): GeneratedListing {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch { /* weiter */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* weiter */ } }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("Die KI-Antwort war unvollständig – bitte nochmal versuchen.");
}

function clean(l: GeneratedListing, mySize: string) {
  const bad = /^(unsure|unbekannt|unknown|n\/a|nicht erkennbar|\?|-|–)?$/i;
  if (mySize) l.size = mySize;
  if (bad.test(String(l.size || "").trim())) {
    l.size = "";
    l.title = String(l.title).replace(/\s*Größe\s+(unsure|unbekannt|unknown|n\/a|nicht erkennbar|\?)/gi, "").replace(/\s{2,}/g, " ").trim();
    l.description = String(l.description || "").split("\n").filter((z) => !/📏.*(unsure|unbekannt|unknown|nicht erkennbar)/i.test(z)).join("\n");
  }
  l.hashtags = (l.hashtags || []).map((t) => String(t).replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean);
  l.colors = (l.colors || []).filter(Boolean);
  l.unsure = (l.unsure || []).filter(Boolean);
  return l;
}

export async function generateListing(images: { data: Buffer; mimeType: string }[], opts: { size: string; cond: string; notes: string }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY fehlt in der .env auf dem Server");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        ...images.map((i) => ({ inlineData: { data: i.data.toString("base64"), mimeType: i.mimeType } })),
        { text: buildPrompt({ ...opts, count: images.length }) },
      ],
    }],
    config: { responseMimeType: "application/json", temperature: 0.7 },
  });
  const l = parseJson(res.text ?? "");
  if (!l?.title) throw new Error("Die KI hat keinen Titel geliefert – bitte nochmal versuchen.");
  return clean(l, opts.size);
}

export const tagsText = (tags: string[]) => tags.map((t) => "#" + String(t).replace(/^#/, "").replace(/\s+/g, "")).join(" ");
