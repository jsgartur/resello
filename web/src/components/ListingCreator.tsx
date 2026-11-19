"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, X, Sparkles, Loader2, Ruler, Send, Save, Copy, Trash2, ExternalLink, Check, Search, Wand2, Star, Plus, FilePlus2 } from "lucide-react";
import type { ListingDraft } from "@/lib/store";
import { saveListingDraft, uploadListingDraft, deleteListingDraft, removeDraftPhoto, makeDraftCover } from "@/app/actions";

export type TemplateOption = { id: string; title: string; brand: string | null; size: string | null; condition: string | null; photo_url: string | null; status: string };

// ---------- Maße-Grafik (aus deinem Maße-Generator) ----------
type MField = { key: string; label: string; unit: string; ph: string; text?: boolean };
const MASSE: Record<"hose" | "jacke", { name: string; row: [number, number]; cols: [number, number][]; fields: MField[] }> = {
  hose: {
    name: "Hose", row: [656 / 1050, 691 / 1050],
    cols: [[120, 206], [206, 293], [293, 388], [388, 479]].map(([a, b]) => [a / 600, b / 600] as [number, number]),
    fields: [
      { key: "groesse", label: "Größe", unit: "", ph: "W32 L32", text: true },
      { key: "laenge", label: "Länge", unit: "cm", ph: "104" },
      { key: "bein", label: "Beinöffnung", unit: "cm", ph: "22" },
      { key: "bund", label: "Bundweite", unit: "cm", ph: "41" },
    ],
  },
  jacke: {
    name: "Jacke / Oberteil", row: [1398 / 2000, 1511 / 2000],
    cols: [[285, 494], [494, 696], [696, 913], [913, 1130]].map(([a, b]) => [a / 1414, b / 1414] as [number, number]),
    fields: [
      { key: "groesse", label: "Größe", unit: "", ph: "M", text: true },
      { key: "breite", label: "Breite", unit: "cm", ph: "56" },
      { key: "arm", label: "Armlänge", unit: "cm", ph: "63" },
      { key: "laenge", label: "Länge", unit: "cm", ph: "70" },
    ],
  },
};
const numv = (v?: string) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
function autoSize(kind: "hose" | "jacke", v: Record<string, string>) {
  const x = kind === "hose" ? numv(v.bund) : numv(v.breite);
  if (!x) return "";
  const table: [number, string][] = kind === "hose" ? [[37.5, "XS"], [40.5, "S"], [44, "M"], [48, "L"], [52, "XL"]] : [[46, "XS"], [50, "S"], [54, "M"], [58, "L"], [62, "XL"]];
  for (const [max, s] of table) if (x <= max) return s;
  return "XXL";
}
const fmtM = (f: MField, v?: string) => { const s = String(v ?? "").trim(); if (!s) return ""; return f.unit && /^\d+([.,]\d+)?$/.test(s) ? s.replace(".", ",") + " " + f.unit : s; };

async function renderMasse(canvas: HTMLCanvasElement, kind: "hose" | "jacke", src: string, values: Record<string, string>, placeholder: boolean, scale = 1) {
  const t = MASSE[kind];
  const im = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  if (!im) return false;
  const v = values.groesse ? values : { ...values, groesse: autoSize(kind, values) };
  const W = im.naturalWidth * scale, H = im.naturalHeight * scale;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d")!;
  c.drawImage(im, 0, 0, W, H);
  try { await document.fonts.load("40px Anton"); } catch { /* egal */ }
  const y0 = t.row[0] * H, y1 = t.row[1] * H, rh = y1 - y0;
  c.textAlign = "center"; c.textBaseline = "middle";
  t.fields.forEach((f, i) => {
    const [a, b] = t.cols[i]; const x0 = a * W, x1 = b * W;
    let txt = fmtM(f, v[f.key]); let ghost = false;
    if (!txt && placeholder) { txt = fmtM(f, f.ph); ghost = true; }
    if (!txt) return;
    let size = rh * 0.52;
    c.font = `${size}px Anton, Impact, sans-serif`;
    while (c.measureText(txt).width > (x1 - x0) * 0.86 && size > 6) { size -= 1; c.font = `${size}px Anton, Impact, sans-serif`; }
    c.fillStyle = ghost ? "rgba(0,0,0,.22)" : "#000";
    c.fillText(txt, (x0 + x1) / 2, (y0 + y1) / 2 + size * 0.04);
  });
  return true;
}

// ---------- Fotos verkleinern ----------
async function shrink(file: Blob, max = 1600): Promise<Blob | null> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return null;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));
}

const nextArt = (a: string) => { const m = a.match(/^(.*?)(\d+)(\D*)$/); return m ? m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, "0") + m[3] : a; };
const STATUS: Record<ListingDraft["status"], [string, string]> = {
  draft: ["Entwurf", "border-line text-muted"],
  queued: ["Wird hochgeladen…", "border-accent/40 bg-accent/10 text-accent"],
  uploaded: ["Auf Vinted ✓", "border-emerald-900 bg-emerald-950/30 text-emerald-300"],
  failed: ["Fehlgeschlagen", "border-red-900 bg-red-950/30 text-red-300"],
};

export function ListingCreator({ drafts, templates, initialId }: { drafts: ListingDraft[]; templates: TemplateOption[]; initialId?: string }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [art, setArt] = useState("");
  const [size, setSize] = useState("");
  const [cond, setCond] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k?: "err" | "ok" } | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initialId ?? null);
  const draft = drafts.find((x) => x.id === draftId) ?? null;
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [tplId, setTplId] = useState("");
  const [tplQ, setTplQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);

  // Maße
  const [mOpen, setMOpen] = useState(false);
  const [mKind, setMKind] = useState<"hose" | "jacke">("hose");
  const [mVals, setMVals] = useState<Record<string, string>>({});
  const [mSrc, setMSrc] = useState<{ hose: string; jacke: string | null }>({ hose: "/masse/hose.png", jacke: null });
  const cvRef = useRef<HTMLCanvasElement>(null);
  const mUpRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { setArt(localStorage.getItem("resello.art") ?? ""); } catch { /* egal */ } fetch("/api/masse").then((r) => r.json()).then(setMSrc).catch(() => {}); }, []);
  useEffect(() => { try { localStorage.setItem("resello.art", art); } catch { /* egal */ } }, [art]);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { const f = Array.from(e.clipboardData?.files ?? []); if (f.length) addFiles(f); };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  // Entwurf in Editor laden
  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title); setDesc(draft.description); setPrice(draft.price != null ? String(draft.price) : ""); setBrand(draft.brand ?? "");
    setTplId(draft.template_listing_id ?? bestTemplate(draft)?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, draft?.updated_at]);

  function bestTemplate(d: ListingDraft) {
    const norm = (s: string | null) => String(s ?? "").toLowerCase().trim();
    let best: TemplateOption | null = null, score = -1;
    for (const t of templates) {
      const sc = (norm(t.brand) && norm(t.brand) === norm(d.brand) ? 2 : 0) + (norm(t.size) && norm(t.size) === norm(d.size) ? 3 : 0);
      if (sc > score) { score = sc; best = t; }
    }
    return score > 0 ? best : null;
  }

  useEffect(() => {
    if (!mOpen || !cvRef.current) return;
    const src = mKind === "hose" ? mSrc.hose : mSrc.jacke;
    if (src) renderMasse(cvRef.current, mKind, src, mVals, true, 1);
  }, [mOpen, mKind, mVals, mSrc]);

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next = [...photos];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith("image/")) continue;
      if (next.length >= 20) { setMsg({ t: "Maximal 20 Fotos.", k: "err" }); break; }
      const blob = await shrink(f);
      if (!blob) { setMsg({ t: `${f.name} konnte nicht gelesen werden (HEIC bitte als JPG speichern).`, k: "err" }); continue; }
      next.push({ blob, url: URL.createObjectURL(blob) });
    }
    setPhotos(next);
  }

  async function addMasseImage() {
    const src = mKind === "hose" ? mSrc.hose : mSrc.jacke;
    if (!src) return;
    const c = document.createElement("canvas");
    await renderMasse(c, mKind, src, mVals, false, 2);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (blob) { setPhotos((p) => [...p, { blob, url: URL.createObjectURL(blob) }]); setMsg({ t: "Maße-Grafik als letztes Foto hinzugefügt.", k: "ok" }); }
    const g = mVals.groesse || autoSize(mKind, mVals);
    if (g && !size) setSize(g);
  }

  async function uploadMasseTemplate(file: File) {
    const fd = new FormData(); fd.append("kind", mKind); fd.append("file", file);
    const r = await fetch("/api/masse", { method: "POST", body: fd });
    const d = await r.json();
    if (d.url) setMSrc((s) => ({ ...s, [mKind]: d.url }));
  }

  async function generate(regenerate = false, skipAi = false) {
    if (!regenerate && !photos.length) { setMsg({ t: "Lade zuerst mindestens ein Foto hoch.", k: "err" }); return; }
    setBusy(true); setMsg(null);
    const fd = new FormData();
    if (!regenerate) photos.forEach((p, i) => fd.append("photos", p.blob, `foto-${i}.jpg`));
    if (regenerate && draftId) fd.append("draft_id", draftId);
    if (skipAi) fd.append("skip_ai", "1");
    fd.append("size", size); fd.append("cond", cond); fd.append("notes", notes); fd.append("art", art);
    try {
      const r = await fetch("/api/listing/generate", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      setDraftId(d.draft.id);
      if (!regenerate) { photos.forEach((p) => URL.revokeObjectURL(p.url)); setPhotos([]); if (art) setArt(nextArt(art)); setNotes(""); setSize(""); setCond(""); }
      setMsg({ t: skipAi ? "Entwurf gespeichert. Bilder im Bildstudio bearbeiten oder später Text mit KI erstellen." : "Fertig! Prüf kurz Marke, Größe und Preis.", k: "ok" });
      router.refresh();
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "Fehler", k: "err" });
    } finally { setBusy(false); }
  }

  async function appendPhotos(list: FileList | null) {
    if (!list || !draftId) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(list)) { const b = await shrink(f); if (b) fd.append("photos", b, "foto.jpg"); }
    fd.append("draft_id", draftId); fd.append("append", "1");
    const r = await fetch("/api/listing/generate", { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) setMsg({ t: (await r.json()).error ?? "Fehler", k: "err" });
    router.refresh();
  }

  function draftForm() {
    const fd = new FormData();
    fd.append("id", draftId ?? ""); fd.append("title", title); fd.append("description", desc);
    fd.append("price", price); fd.append("template_listing_id", tplId); fd.append("brand", brand);
    return fd;
  }
  async function save() { await saveListingDraft(draftForm()); setMsg({ t: "Entwurf gespeichert.", k: "ok" }); router.refresh(); }
  async function upload() {
    setUploading(true); setMsg(null);
    const r = await uploadListingDraft(draftForm());
    setUploading(false);
    if (!r.ok) { setMsg({ t: r.error ?? "Fehler", k: "err" }); return; }
    setMsg({ t: "Wird hochgeladen – die Erweiterung erledigt das in 1–2 Minuten, solange Chrome mit Vinted offen ist.", k: "ok" });
    router.refresh();
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); setMsg({ t: "Kopiert.", k: "ok" }); } catch { /* egal */ } }

  const tpl = templates.find((t) => t.id === tplId) ?? null;
  const tplList = useMemo(() => {
    const q = tplQ.toLowerCase();
    return templates.filter((t) => !q || `${t.title} ${t.brand} ${t.size}`.toLowerCase().includes(q)).slice(0, 40);
  }, [templates, tplQ]);
  const locked = draft?.status === "queued" || draft?.status === "uploaded";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ----- Links: Fotos & Angaben ----- */}
        <section className="card space-y-4 p-4 lg:p-5">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="grid cursor-pointer place-items-center gap-1 rounded-xl border-[1.5px] border-dashed border-line bg-panel-2/40 p-5 text-center text-sm text-muted hover:border-accent/60">
            <Upload size={20} className="text-accent" />
            <b className="text-white">Fotos hinzufügen</b>
            <span className="text-xs">Vorderseite, Etikett, Logo, Details · Strg+V geht auch</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={p.url} className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px]">Titelbild</span>}
                  <button onClick={() => { URL.revokeObjectURL(p.url); setPhotos(photos.filter((_, j) => j !== i)); }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}

          <div><label className="label">Artikelnummer</label><input value={art} onChange={(e) => setArt(e.target.value)} placeholder="z. B. A-101" className="input font-[Anton] text-lg tracking-wide" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Größe</label><input value={size} onChange={(e) => setSize(e.target.value)} placeholder="leer = vom Etikett" className="input" /></div>
            <div>
              <label className="label">Zustand</label>
              <select value={cond} onChange={(e) => setCond(e.target.value)} className="input">
                <option value="">automatisch</option>
                {["Neu mit Etikett", "Neu ohne Etikett", "Sehr gut", "Gut", "Zufriedenstellend"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Notizen (optional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="z. B. kleiner Fleck am Ärmel, Jacke + Hose als Set, Open leg" className="input" /></div>

          {/* Maße-Grafik */}
          <div className="rounded-xl border border-line">
            <button onClick={() => setMOpen(!mOpen)} className="flex w-full items-center justify-between p-3 text-sm font-medium">
              <span className="flex items-center gap-2"><Ruler size={16} className="text-accent" />Maße-Grafik hinzufügen</span>
              <span className="text-xs text-muted">{mOpen ? "schließen" : "öffnen"}</span>
            </button>
            {mOpen && (
              <div className="space-y-3 border-t border-line p-3">
                <div className="flex gap-2">
                  {(["hose", "jacke"] as const).map((k) => (
                    <button key={k} onClick={() => setMKind(k)} className={`rounded-full border px-3 py-1 text-xs ${mKind === k ? "border-accent/60 bg-accent/10 text-white" : "border-line text-muted"}`}>{MASSE[k].name}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MASSE[mKind].fields.map((f) => (
                    <div key={f.key}>
                      <label className="label">{f.label}{f.unit ? ` (${f.unit})` : ""}</label>
                      <input value={mVals[f.key] ?? ""} onChange={(e) => setMVals({ ...mVals, [f.key]: e.target.value })} inputMode={f.text ? "text" : "decimal"} placeholder={f.key === "groesse" ? (autoSize(mKind, mVals) ? `auto: ${autoSize(mKind, mVals)}` : "leer = automatisch") : f.ph} className="input" />
                    </div>
                  ))}
                </div>
                {(mKind === "hose" ? mSrc.hose : mSrc.jacke) ? (
                  <canvas ref={cvRef} className="w-full rounded-lg border border-line bg-white" />
                ) : (
                  <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">Für „{MASSE[mKind].name}“ fehlt noch deine Grafik.</div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button disabled={!(mKind === "hose" ? mSrc.hose : mSrc.jacke)} onClick={addMasseImage} className="btn-primary"><Ruler size={15} />Als Foto hinzufügen</button>
                  <button onClick={() => mUpRef.current?.click()} className="btn-ghost text-xs">Eigene Grafik hochladen</button>
                  <input ref={mUpRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadMasseTemplate(e.target.files[0])} />
                </div>
              </div>
            )}
          </div>

          <button onClick={() => generate(false)} disabled={busy || !photos.length} className="btn-primary w-full py-3 text-base">
            {busy ? <><Loader2 size={18} className="animate-spin" />KI schaut sich die Fotos an…</> : <><Sparkles size={18} />Listing mit KI erstellen</>}
          </button>
          <button onClick={() => generate(false, true)} disabled={busy || !photos.length} className="btn-ghost w-full"><FilePlus2 size={16} />Nur als Entwurf speichern (Text später)</button>
          {msg && <div className={`text-sm ${msg.k === "err" ? "text-red-400" : msg.k === "ok" ? "text-emerald-300" : "text-muted"}`}>{msg.t}</div>}
        </section>

        {/* ----- Rechts: Ergebnis ----- */}
        <section className="card space-y-4 p-4 lg:p-5">
          {!draft ? (
            <div className="grid h-full min-h-[300px] place-items-center text-center text-sm text-muted">
              <div><Sparkles size={28} className="mx-auto mb-3 text-accent" />Fotos links hinzufügen und auf <b className="text-white">Listing mit KI erstellen</b> klicken.<br />Titel, Beschreibung, Hashtags und Preisvorschlag erscheinen dann hier.</div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="label mb-0">Dein Listing</span><span className={`badge ${STATUS[draft.status][1]}`}>{STATUS[draft.status][0]}</span></div>
                <div className="flex gap-2">
                  <button onClick={() => generate(true)} disabled={busy || locked} className="btn-ghost text-xs"><Sparkles size={14} />Neu generieren</button>
                  <button onClick={() => copy(`${title}\n\n${desc}`)} className="btn-ghost text-xs"><Copy size={14} />Kopieren</button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {draft.photos.map((p, i) => (
                  <div key={p} className={`group relative h-28 w-[84px] shrink-0 overflow-hidden rounded-lg border ${i === 0 ? "border-accent" : "border-line"}`}>
                    <img src={`/api/bilder/${p}`} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[9px]">Titelbild</span>}
                    {!locked && (
                      <div className="absolute right-1 top-1 flex flex-col gap-1">
                        <button title="Entfernen" onClick={async () => { await removeDraftPhoto(draft.id, p); router.refresh(); }} className="rounded-full bg-black/75 p-1 hover:text-red-400"><X size={11} /></button>
                        {i > 0 && <button title="Als Titelbild" onClick={async () => { await makeDraftCover(draft.id, p); router.refresh(); }} className="rounded-full bg-black/75 p-1 hover:text-accent"><Star size={11} /></button>}
                      </div>
                    )}
                  </div>
                ))}
                {!locked && <>
                  <button onClick={() => addRef.current?.click()} className="grid h-28 w-[84px] shrink-0 place-items-center rounded-lg border border-dashed border-line text-[11px] text-muted hover:border-accent"><span className="flex flex-col items-center gap-1"><Plus size={16} />Foto</span></button>
                  <Link href={`/studio?draft=${draft.id}`} className="grid h-28 w-[84px] shrink-0 place-items-center rounded-lg border border-dashed border-accent/50 bg-accent/5 text-center text-[11px] text-accent hover:bg-accent/10"><span className="flex flex-col items-center gap-1"><Wand2 size={16} />Bildstudio</span></Link>
                </>}
                <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => { appendPhotos(e.target.files); e.target.value = ""; }} />
              </div>
              {!draft.title && !locked && (
                <button onClick={() => generate(true)} disabled={busy} className="btn-primary w-full">{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Titel & Beschreibung jetzt mit KI erstellen</button>
              )}

              <div>
                <div className="mb-1 flex justify-between"><label className="label mb-0">Titel</label><span className="text-[11px] text-muted">{title.length} Zeichen</span></div>
                <textarea value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} rows={2} className="input font-[Anton] text-lg leading-snug tracking-wide" />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-panel-2/40 p-2.5"><div className="label mb-0.5">Marke</div><input value={brand} onChange={(e) => setBrand(e.target.value)} disabled={locked} className="w-full bg-transparent text-sm font-medium outline-none" /></div>
                {[["Größe", draft.size], ["Zustand", draft.condition], ["Farbe", draft.colors.join(", ")], ["Kategorie", draft.category]].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line bg-panel-2/40 p-2.5"><div className="label mb-0.5">{k}</div><div className="truncate text-sm font-medium">{v || "–"}</div></div>
                ))}
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-2.5">
                  <div className="label mb-0.5">Preis (€)</div>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} disabled={locked} inputMode="decimal" className="w-full bg-transparent font-[Anton] text-xl tracking-wide outline-none" />
                  {draft.price_low && <div className="text-[10px] text-muted">Spanne {draft.price_low}–{draft.price_high} €</div>}
                </div>
              </div>
              {draft.unsure.length > 0 && <div className="rounded-r-lg border-l-2 border-amber-400 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">Bitte prüfen: {draft.unsure.join(" · ")}</div>}

              <div>
                <div className="mb-1 flex justify-between"><label className="label mb-0">Beschreibung inkl. Hashtags</label><span className="text-[11px] text-muted">{desc.length} Zeichen</span></div>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={locked} rows={12} className="input text-sm leading-relaxed" />
              </div>

              {/* Vorlage-Artikel */}
              <div className="rounded-xl border border-line p-3">
                <div className="mb-1 text-sm font-medium">Vorlage-Artikel</div>
                <p className="mb-2 text-xs text-muted">Vinted braucht Kategorie, Größe und Paketgröße als feste Auswahl. Die übernimmt Resello von einem deiner Artikel. Nimm einen <b className="text-white">ähnlichen Artikel mit gleicher Größe</b> (z. B. andere Jeans in W32).</p>
                {tpl ? (
                  <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 p-2">
                    {tpl.photo_url ? <img src={tpl.photo_url} alt="" className="h-12 w-10 rounded object-cover" /> : <div className="h-12 w-10 rounded bg-panel-2" />}
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{tpl.title}</div><div className="text-xs text-muted">{[tpl.brand, tpl.size, tpl.condition].filter(Boolean).join(" · ")}</div></div>
                    {!locked && <button onClick={() => setTplId("")} className="btn-ghost text-xs">Ändern</button>}
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={tplQ} onChange={(e) => setTplQ(e.target.value)} placeholder="Artikel suchen (z. B. Jeans W32)" className="input pl-8" /></div>
                    <div className="max-h-60 space-y-1 overflow-y-auto">
                      {tplList.map((t) => (
                        <button key={t.id} onClick={() => setTplId(t.id)} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-panel-2">
                          {t.photo_url ? <img src={t.photo_url} alt="" className="h-10 w-8 rounded object-cover" /> : <div className="h-10 w-8 rounded bg-panel-2" />}
                          <div className="min-w-0 flex-1"><div className="truncate text-sm">{t.title}</div><div className="text-[11px] text-muted">{[t.brand, t.size, t.status === "sold" ? "verkauft" : null].filter(Boolean).join(" · ")}</div></div>
                        </button>
                      ))}
                      {!tplList.length && <div className="p-2 text-xs text-muted">Keine Artikel gefunden. Erst einmal synchronisieren.</div>}
                    </div>
                  </>
                )}
              </div>

              {draft.status === "failed" && draft.error && <div className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-xs text-red-300">Fehler beim Hochladen: {draft.error}</div>}
              {draft.status === "queued" && draft.error && <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-300">Neuer Versuch läuft. Letzter Fehler: {draft.error}</div>}
              {draft.status === "uploaded" && draft.vinted_url && <a href={draft.vinted_url} target="_blank" className="btn-ghost w-full"><ExternalLink size={15} />Auf Vinted ansehen</a>}

              {!locked && (
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <button onClick={save} className="btn-ghost"><Save size={15} />Speichern</button>
                  <button onClick={upload} disabled={uploading} className="btn-primary py-2.5">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Auf Vinted hochladen</button>
                </div>
              )}
              {draft.status === "uploaded" && <p className="text-xs text-muted">Tipp: Farbe und Größe kommen vom Vorlage-Artikel. Passt etwas nicht, kurz in Vinted bearbeiten.</p>}
            </>
          )}
        </section>
      </div>

      {/* ----- Verlauf ----- */}
      <section className="card p-4 lg:p-5">
        <div className="mb-3 flex items-center justify-between"><div className="text-sm font-medium">Entwürfe & Angebote</div><span className="text-xs text-muted">{drafts.filter((d) => d.status === "draft").length} offene Entwürfe</span></div>
        {!drafts.length && <div className="text-sm text-muted">Hier landen deine erstellten Listings.</div>}
        <div className="grid gap-2 md:grid-cols-2">
          {[...drafts].reverse().map((d) => (
            <div key={d.id} className={`flex items-center gap-3 rounded-xl border p-2 ${d.id === draftId ? "border-accent/60 bg-accent/5" : "border-line"}`}>
              {d.photos[0] ? <img src={`/api/bilder/${d.photos[0]}`} alt="" className="h-14 w-11 rounded-lg object-cover" /> : <div className="h-14 w-11 rounded-lg bg-panel-2" />}
              <button onClick={() => { setDraftId(d.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm">{d.art ? `${d.art} · ` : ""}{d.title || <span className="text-muted">Entwurf ohne Titel</span>}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted"><span className={`badge ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>{d.price ? `${d.price} €` : ""}</div>
              </button>
              {d.status === "uploaded" ? <Check size={16} className="text-emerald-400" /> : <button onClick={async () => { await deleteListingDraft(d.id); if (draftId === d.id) setDraftId(null); router.refresh(); }} className="p-1 text-muted hover:text-red-400"><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
