/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { read } from "@/lib/store";
import { eur, relDays } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import { queueRelist, queuePriceDrop, queuePriceChange, updateListingPrices, cancelJob } from "@/app/actions";
import { Repeat, TrendingDown, Eye, Heart, Clock, X, Search } from "lucide-react";

const FILTERS = [
  { key: "active", label: "Aktiv" },
  { key: "stale", label: "Ladenhüter (14+ Tage)" },
  { key: "sold", label: "Verkauft" },
  { key: "all", label: "Alle" },
];

const JOB_TEXT: Record<string, string> = { relist: "Neu einstellen geplant", price_change: "Preisänderung geplant" };

export default async function Listings({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const { f = "active", q = "" } = await searchParams;
  const d = read();
  const staleBefore = new Date(Date.now() - 14 * 86400000).toISOString();
  const openJobs = d.jobs.filter((j) => (j.status === "queued" || j.status === "running") && j.payload.listing_id);
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const recentJobs = d.jobs.filter((j) => (j.status === "done" || j.status === "failed") && j.payload.listing_id && (j.finished_at ?? "") >= dayAgo);
  const retrying = (j: { attempts: number; error: string | null; status: string }) => j.status === "queued" && j.attempts > 0 && j.error;
  const listings = d.listings
    .filter((l) => (f === "all" ? l.status !== "deleted" : f === "sold" ? l.status === "sold" : l.status === "active"))
    .filter((l) => f !== "stale" || (l.listed_at ?? "") < staleBefore)
    .filter((l) => !q || l.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(a.listed_at).localeCompare(String(b.listed_at)))
    .slice(0, 300);
  const extensionOnline = d.accounts.some((a) => a.connection === "extension" && a.last_sync_at && Date.now() - new Date(a.last_sync_at).getTime() < 3600000);

  return (
    <>
      <PageHeader title="Angebote" sub={`${listings.length} Artikel · älteste zuerst · Mindestpreis = Untergrenze für Preissenkungen`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/angebote?f=${x.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-3 py-1 text-xs ${x.key === f ? "border-accent/60 bg-accent/10 text-white" : "border-line text-muted hover:text-white"}`}>{x.label}</Link>
        ))}
        <form className="relative ml-auto">
          <input type="hidden" name="f" value={f} />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Artikel suchen…" className="input w-60 pl-9" />
        </form>
      </div>

      {!extensionOnline && listings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          Aufträge werden ausgeführt, sobald Chrome mit einem eingeloggten Vinted-Tab offen ist (ca. 1 Auftrag pro Minute).
        </div>
      )}

      {!listings.length ? (
        <Empty title="Keine Artikel">Sobald ein Konto synchronisiert ist, erscheinen deine Vinted-Artikel hier.</Empty>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => {
            const jobs = openJobs.filter((j) => j.payload.listing_id === l.id);
            const recent = recentJobs.filter((j) => j.payload.listing_id === l.id).slice(-2);
            const atMin = l.min_price != null && l.price <= l.min_price;
            return (
              <div key={l.id} className="card flex flex-wrap items-center gap-4 p-3">
                {l.photo_url ? <img src={l.photo_url} alt="" className="h-20 w-16 rounded-lg object-cover" /> : <div className="h-20 w-16 rounded-lg bg-panel-2" />}

                <div className="min-w-56 flex-1">
                  <a href={l.url ?? "#"} target="_blank" className="font-medium hover:underline">{l.title}</a>
                  <div className="mt-0.5 text-xs text-muted">{[l.brand, l.size, l.condition].filter(Boolean).join(" · ")}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><Eye size={12} />{l.views}</span>
                    <span className="flex items-center gap-1"><Heart size={12} />{l.favourites}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />online seit {relDays(l.last_relisted_at ?? l.listed_at).replace("vor ", "")}</span>
                    {l.status !== "active" && <span className="badge">{l.status === "sold" ? "verkauft" : l.status}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                  {jobs.map((j) => (
                    <div key={j.id} className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs ${retrying(j) ? "border-amber-900 bg-amber-950/30 text-amber-300" : "border-accent/40 bg-accent/10 text-accent"}`} title={j.error ?? ""}>
                      {j.status === "running" ? "⏳ Wird gerade ausgeführt…" : retrying(j) ? `⚠ Fehlgeschlagen, neuer Versuch (${j.attempts}/3)` : `🕓 ${JOB_TEXT[j.type] ?? j.type} – wartet auf Chrome`}{j.type === "price_change" ? ` (${eur(j.payload.price)})` : ""}
                      {j.status === "queued" && <form action={cancelJob.bind(null, j.id)}><button title="Abbrechen"><X size={12} /></button></form>}
                    </div>
                  ))}
                  {recent.map((j) => (
                    <div key={j.id} title={j.error ?? ""} className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${j.status === "done" ? "border-emerald-900 bg-emerald-950/30 text-emerald-300" : "border-red-900 bg-red-950/30 text-red-300"}`}>
                      {j.status === "done"
                        ? `✓ ${j.type === "relist" ? "Neu eingestellt" : `Preis geändert auf ${eur(j.payload.price)}`} · ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(j.finished_at!))}`
                        : `✗ ${j.type === "relist" ? "Relist" : "Preisänderung"} fehlgeschlagen: ${(j.error ?? "").slice(0, 80)}`}
                    </div>
                  ))}
                  </div>
                </div>

                <div className="w-24 text-right">
                  <div className="text-lg font-semibold">{eur(l.price)}</div>
                  {l.min_price != null && <div className="text-[11px] text-muted">min. {eur(l.min_price)}</div>}
                </div>

                {l.status === "active" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={queueRelist.bind(null, l.id)}>
                      <button disabled={jobs.some((j) => j.type === "relist")} className="btn-primary"><Repeat size={15} />Jetzt relisten</button>
                    </form>
                    <form action={queuePriceDrop.bind(null, l.id, 10)}>
                      <button disabled={atMin || jobs.some((j) => j.type === "price_change")} title={atMin ? "Mindestpreis erreicht" : ""} className="btn-ghost"><TrendingDown size={15} />−10 %</button>
                    </form>
                    <details className="relative">
                      <summary className="btn-ghost cursor-pointer list-none">Mehr</summary>
                      <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border border-line bg-panel p-4 shadow-2xl">
                        <form action={queuePriceChange} className="flex items-end gap-2">
                          <input type="hidden" name="id" value={l.id} />
                          <div className="flex-1"><label className="label">Neuer Preis (€)</label><input name="price" className="input" placeholder={String(l.price)} /></div>
                          <button className="btn-ghost">Setzen</button>
                        </form>
                        <form action={queuePriceDrop.bind(null, l.id, 20)}><button className="btn-ghost w-full">Preis −20 %</button></form>
                        <form action={updateListingPrices} className="grid grid-cols-2 gap-2 border-t border-line pt-3">
                          <input type="hidden" name="id" value={l.id} />
                          <div><label className="label">Mindestpreis</label><input name="min_price" defaultValue={l.min_price ?? ""} className="input" /></div>
                          <div><label className="label">Einkaufspreis</label><input name="purchase_price" defaultValue={l.purchase_price ?? ""} className="input" /></div>
                          <button className="btn-ghost col-span-2">Speichern</button>
                        </form>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
