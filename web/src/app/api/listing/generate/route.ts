import { NextRequest, NextResponse } from "next/server";
import { read, write, id, now, saveImage, readImage, ListingDraft } from "@/lib/store";
import { generateListing, tagsText } from "@/lib/listing-ai";
import { blankDraft } from "@/lib/drafts";

export const maxDuration = 120;
const ext = (mime: string) => (mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg");

/**
 * Fotos speichern + KI-Listing erzeugen.
 * draft_id: vorhandenen Entwurf neu auswerten · append=1: Fotos an Entwurf anhängen (ohne KI)
 * skip_ai=1: nur Entwurf mit Fotos anlegen, Text später
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const draftId = String(form.get("draft_id") || "");
    const size = String(form.get("size") || "").trim();
    const cond = String(form.get("cond") || "");
    const notes = String(form.get("notes") || "").trim();
    const art = String(form.get("art") || "").trim() || null;
    const skipAi = form.get("skip_ai") === "1";
    const append = form.get("append") === "1";

    let photos: string[] = [];
    const existing = draftId ? read().listing_drafts.find((x) => x.id === draftId) : null;
    const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 20);
    if (files.length) {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      for (const [i, f] of files.entries()) photos.push(saveImage(`listings/${stamp}-${i}.${ext(f.type)}`, Buffer.from(await f.arrayBuffer())));
    }
    if (existing && (append || !files.length)) photos = append ? [...existing.photos, ...photos].slice(0, 20) : existing.photos;
    if (!photos.length) return NextResponse.json({ error: "Bitte mindestens ein Foto hinzufügen" }, { status: 400 });

    if (append && existing) {
      const updated = write((d) => { const dr = d.listing_drafts.find((x) => x.id === existing.id)!; dr.photos = photos; dr.updated_at = now(); return { ...dr }; });
      return NextResponse.json({ draft: updated });
    }
    if (skipAi) {
      const dr = existing ? { ...existing, photos, updated_at: now() } : blankDraft(photos, art);
      if (!existing && art) dr.description = "Artikelnummer: " + art;
      write((d) => { d.listing_drafts = d.listing_drafts.filter((x) => x.id !== dr.id); d.listing_drafts.push(dr); });
      return NextResponse.json({ draft: dr });
    }

    // KI bekommt max. 6 Fotos (Kosten/Zeit), Maße-Grafik am Ende ist mit dabei
    const forAi = photos.slice(0, 6).map((p) => ({ data: readImage(p), mimeType: p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg" }));
    const l = await generateListing(forAi, { size, cond, notes });
    const description = l.description.trim() + (l.hashtags.length ? "\n\n" + tagsText(l.hashtags) : "") + (art ? "\n\nArtikelnummer: " + art : "");

    const draft: ListingDraft = {
      id: existing?.id ?? id(), art, photos, title: l.title, description, hashtags: l.hashtags,
      brand: l.brand || null, size: l.size || null, condition: l.condition || cond || null, colors: l.colors, category: l.category || null,
      price: l.price?.suggested || null, price_low: l.price?.low || null, price_high: l.price?.high || null, unsure: l.unsure,
      template_listing_id: existing?.template_listing_id ?? null, account_id: existing?.account_id ?? null,
      status: "draft", vinted_item_id: null, vinted_url: null, error: null,
      created_at: existing?.created_at ?? now(), updated_at: now(),
    };
    write((d) => {
      d.listing_drafts = d.listing_drafts.filter((x) => x.id !== draft.id);
      d.listing_drafts.push(draft);
    });
    return NextResponse.json({ draft });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fehler" }, { status: 500 });
  }
}
