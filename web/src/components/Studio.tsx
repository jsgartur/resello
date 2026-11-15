"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Upload, X, Download, Loader2, Check, Sparkles } from "lucide-react";
import { ToolArt } from "@/components/ToolArt";

type Tool = "tryon" | "background" | "flatlay" | "enhance" | "custom";
type Model = { id: string; name: string; gender: string; url: string; source?: string };

const TOOLS: { id: Tool; title: string; desc: string; badge: string }[] = [
  { id: "tryon", title: "Marketplace Try-on", desc: "Kleidung aufs Model.", badge: "Auto" },
  { id: "custom", title: "Custom", desc: "Eigener Prompt.", badge: "Prompt" },
  { id: "flatlay", title: "Flatlay", desc: "Artikel von oben in Szene setzen.", badge: "Szene" },
  { id: "background", title: "Hintergrund", desc: "Freistellen & neuer Hintergrund.", badge: "Freisteller" },
  { id: "enhance", title: "Aufbessern & Bügeln", desc: "Schärfer, glatter, bessere Farben.", badge: "Upscale" },
];

export function Studio() {
  const [tool, setTool] = useState<Tool>("tryon");
  const [step, setStep] = useState(1);
  const [garments, setGarments] = useState<File[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [gender, setGender] = useState<"own" | "all" | "m" | "w">("all");
  const [genBusy, setGenBusy] = useState<{ done: number; total: number } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [opts, setOpts] = useState({ topFit: "original", pantsFit: "original", background: "white", flatlayStyle: "minimal", custom: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; input: string } | null>(null);
  const [split, setSplit] = useState(50);
  const garmentInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch("/api/studio/models").then((r) => r.json()).then((d) => setModels(d.models ?? [])).catch(() => {}); }, []);

  const steps = tool === "tryon" ? ["Tool", "Kleidungsstück", "Model", "Generieren"] : ["Tool", "Foto", "Generieren"];
  const lastStep = steps.length;

  function addGarments(list: FileList | null) {
    if (!list) return;
    setGarments((g) => [...g, ...Array.from(list)].slice(0, 3));
  }

  async function uploadModel(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name.replace(/\.[^.]+$/, ""));
    fd.append("gender", gender === "m" || gender === "w" ? gender : "x");
    const r = await fetch("/api/studio/models", { method: "POST", body: fd });
    const d = await r.json();
    if (d.model) { setModels((m) => [d.model, ...m]); setModelId(d.model.id); }
  }

  async function fillGallery(g: "m" | "w", count: number) {
    setGenError(null);
    setGenBusy({ done: 0, total: count });
    for (let i = 0; i < count; i++) {
      try {
        const r = await fetch("/api/studio/models/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gender: g }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Fehler");
        setModels((m) => [d.model, ...m]);
      } catch (e) {
        setGenError(e instanceof Error ? e.message : "Fehler"); break;
      }
      setGenBusy({ done: i + 1, total: count });
    }
    setGenBusy(null);
  }

  async function generate() {
    setBusy(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append("tool", tool);
    garments.forEach((g) => fd.append("garments", g));
    if (modelId) fd.append("model_id", modelId);
    Object.entries(opts).forEach(([k, v]) => fd.append(k, v));
    try {
      const r = await fetch("/api/studio/generate", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler bei der Generierung");
      setResult(d); setSplit(50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const sel = (key: keyof typeof opts, values: [string, string][], label: string) => (
    <div>
      <label className="label">{label}</label>
      <select value={opts[key]} onChange={(e) => setOpts({ ...opts, [key]: e.target.value })} className="input">
        {values.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      {/* Schrittanzeige */}
      <div className="mb-6 flex gap-6 border-b border-line">
        {steps.map((s, i) => (
          <button key={s} onClick={() => i + 1 < step && setStep(i + 1)}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm ${step === i + 1 ? "border-accent text-white" : "border-transparent text-muted"}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${step > i + 1 ? "bg-emerald-600" : step === i + 1 ? "bg-accent text-black" : "bg-panel-2"}`}>{step > i + 1 ? "✓" : i + 1}</span>
            {s}
          </button>
        ))}
      </div>

      {/* 1: Tool */}
      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => { setTool(t.id); setStep(2); setResult(null); }}
              className={`card group overflow-hidden p-2 text-left transition hover:border-accent/60 ${tool === t.id ? "border-accent/70" : ""}`}>
              <div className="aspect-[16/9] overflow-hidden rounded-lg bg-panel-2/60 transition group-hover:bg-panel-2"><ToolArt tool={t.id} /></div>
              <div className="flex items-center justify-between px-2 pt-3">
                <span className="badge">{t.badge}</span>
                {tool === t.id && <span className="grid h-5 w-5 place-items-center rounded bg-white text-black"><Check size={13} /></span>}
              </div>
              <div className="px-2 pb-2 pt-2">
                <div className="font-medium">{t.title}</div>
                <div className="text-sm text-muted">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 2: Fotos + Optionen */}
      {step === 2 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="card p-5"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addGarments(e.dataTransfer.files); }}>
            <div className="mb-3 text-sm font-medium">Fotos vom Artikel (bis zu 3 – z. B. vorne, hinten, Detail)</div>
            <div className="flex flex-wrap gap-3">
              {garments.map((g, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(g)} alt="" className="h-40 w-32 rounded-lg object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px]">Titelbild</span>}
                  <button onClick={() => setGarments(garments.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1"><X size={12} /></button>
                </div>
              ))}
              {garments.length < 3 && (
                <button onClick={() => garmentInput.current?.click()} className="grid h-40 w-32 place-items-center rounded-lg border border-dashed border-line text-sm text-muted hover:border-accent">
                  <span className="flex flex-col items-center gap-1"><Upload size={18} />Foto hinzufügen</span>
                </button>
              )}
            </div>
            <input ref={garmentInput} type="file" accept="image/*" multiple hidden onChange={(e) => addGarments(e.target.files)} />
          </div>
          <div className="card space-y-3 p-5">
            <div className="text-sm font-medium">Optionen</div>
            {tool === "tryon" && <>
              {sel("topFit", [["original", "Original beibehalten"], ["oversized", "Oversized"], ["regular", "Regular"], ["slim", "Slim"]], "Oberteil-Schnitt")}
              {sel("pantsFit", [["original", "Original beibehalten"], ["baggy", "Baggy"], ["straight", "Straight"], ["slim", "Slim"]], "Hosen-Schnitt")}
            </>}
            {tool === "background" && sel("background", [["white", "Weiß"], ["studio", "Fotostudio grau"], ["street", "Straße (unscharf)"]], "Hintergrund")}
            {tool === "flatlay" && sel("flatlayStyle", [["minimal", "Minimal hell"], ["wood", "Holzboden"], ["marble", "Marmor"], ["linen", "Leinen"], ["concrete", "Beton"]], "Untergrund")}
            {tool === "custom" && (
              <div><label className="label">Anweisung</label>
                <textarea rows={5} value={opts.custom} onChange={(e) => setOpts({ ...opts, custom: e.target.value })} className="input" placeholder="z. B. Lege die Jacke auf eine Parkbank im Herbst…" /></div>
            )}
            {tool === "enhance" && <p className="text-sm text-muted">Keine Optionen nötig.</p>}
          </div>
          <div className="flex justify-between lg:col-span-2">
            <button onClick={() => setStep(1)} className="btn-ghost">Zurück</button>
            <button disabled={!garments.length || (tool === "custom" && !opts.custom)} onClick={() => setStep(3)} className="btn-primary">Weiter</button>
          </div>
        </div>
      )}

      {/* 3: Model (nur Try-on) */}
      {step === 3 && tool === "tryon" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold">Model auswählen</div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["own", "all", "m", "w"] as const).map((g) => (
                <button key={g} onClick={() => setGender(g)} className={`rounded-full border px-4 py-1.5 text-sm ${gender === g ? "border-white/40 bg-panel-2 text-white" : "border-line text-muted hover:text-white"}`}>
                  {{ own: "Eigene Galerie", all: "Alle", m: "Männer", w: "Frauen" }[g]}
                </button>
              ))}
            </div>
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-5">
              <button onClick={() => setModelId(null)} className={`flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-sm ${modelId === null ? "border-accent ring-1 ring-accent" : "border-line text-muted"}`}>
                <Sparkles size={20} className="text-accent" />KI wählt ein passendes Model
              </button>
              {models
                .filter((m) => gender === "all" ? true : gender === "own" ? m.source !== "ki" : m.gender === gender)
                .map((m) => (
                  <button key={m.id} onClick={() => setModelId(m.id)} className={`overflow-hidden rounded-xl border bg-panel-2/40 p-1.5 text-left ${modelId === m.id ? "border-accent ring-1 ring-accent" : "border-line hover:border-white/30"}`}>
                    <img src={m.url} alt={m.name} className="aspect-[3/4] w-full rounded-lg object-cover" />
                    <div className="truncate px-1 pt-1.5 text-xs font-medium">{m.name}</div>
                    <div className="px-1 pb-1 text-[11px] text-muted">{m.gender === "m" ? "Männer" : m.gender === "w" ? "Frauen" : "Eigenes Foto"}</div>
                  </button>
                ))}
            </div>
            {!models.length && <p className="mt-4 text-sm text-muted">Noch keine Models. Lass rechts die KI deine Galerie füllen oder lade eigene Fotos hoch.</p>}
          </div>

          <div className="space-y-4">
            <div className="card space-y-3 p-5 text-sm">
              <div className="font-medium">Galerie mit KI füllen</div>
              <p className="text-muted">Erstellt erfundene Personen im Fitpic-Stil (Gesicht nicht im Bild). Einmal anlegen, dann immer wieder nutzen.</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={!!genBusy} onClick={() => fillGallery("m", 6)} className="btn-ghost">+6 Männer</button>
                <button disabled={!!genBusy} onClick={() => fillGallery("w", 6)} className="btn-ghost">+6 Frauen</button>
              </div>
              {genBusy && <div className="flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin text-accent" />Erstelle {genBusy.done + 1} von {genBusy.total} …</div>}
              {genError && <div className="text-red-400">{genError}</div>}
            </div>
            <div className="card space-y-3 p-5 text-sm">
              <div className="font-medium">Eigenes Model hochladen</div>
              <p className="text-muted">Ganze Person sichtbar, gleichmäßiges Licht, schlichte Kleidung. Nur Fotos von dir oder Personen, die zugestimmt haben.</p>
              <button onClick={() => modelInput.current?.click()} className="btn-ghost w-full"><Upload size={16} />Foto auswählen</button>
              <input ref={modelInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadModel(e.target.files[0])} />
            </div>
          </div>
          <div className="flex justify-between lg:col-span-2">
            <button onClick={() => setStep(2)} className="btn-ghost">Zurück</button>
            <button onClick={() => setStep(4)} className="btn-primary">Weiter</button>
          </div>
        </div>
      )}

      {/* Letzter Schritt: Generieren */}
      {step === lastStep && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="card grid min-h-[480px] place-items-center p-4">
            {busy && <div className="flex flex-col items-center gap-3 text-sm text-muted"><Loader2 className="animate-spin text-accent" size={32} />Bild wird erstellt… (meist 10–30 Sek.)</div>}
            {!busy && error && <div className="max-w-md text-center text-sm text-red-400">{error}</div>}
            {!busy && !error && !result && <div className="text-sm text-muted">Bereit zum Generieren.</div>}
            {!busy && result && (
              <div className="relative w-full max-w-md select-none overflow-hidden rounded-lg">
                <img src={result.url} alt="Ergebnis" className="block w-full" />
                <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                  <img src={result.input} alt="Vorher" className="h-full w-full object-cover" />
                </div>
                <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${split}%` }} />
                <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[11px]">Vorher</span>
                <span className="absolute right-2 top-2 rounded bg-accent px-2 py-0.5 text-[11px] text-black">Nachher</span>
                <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="absolute inset-x-0 bottom-3 mx-auto w-2/3 accent-teal-400" />
              </div>
            )}
          </div>
          <div className="card space-y-4 p-5 text-sm">
            <div>
              <div className="text-xs text-muted">Zusammenfassung</div>
              <div className="text-lg font-medium">{TOOLS.find((t) => t.id === tool)?.title}</div>
              <div className="text-muted">{garments.length} Foto(s){tool === "tryon" ? ` · Model: ${modelId ? models.find((m) => m.id === modelId)?.name : "KI"}` : ""}</div>
            </div>
            <button onClick={generate} disabled={busy} className="btn-primary w-full">{result ? "Nochmal generieren" : "Generieren"}</button>
            {result && <a href={result.url} download target="_blank" className="btn-ghost w-full"><Download size={16} />Herunterladen</a>}
            <button onClick={() => { setStep(2); setResult(null); }} className="btn-ghost w-full">Auswahl bearbeiten</button>
            <button onClick={() => { setStep(1); setGarments([]); setResult(null); setModelId(null); }} className="w-full text-xs text-muted hover:text-white">Neues Bild starten</button>
          </div>
        </div>
      )}
    </div>
  );
}
