/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { read } from "@/lib/store";
import { eur, relDays } from "@/lib/format";
import { PageHeader, Empty, StatusBadge } from "@/components/ui";
import { queueRelist, queuePriceChange, updateListingPrices } from "@/app/actions";

const FILTERS = [
  { key: "active", label: "Aktiv" },
  { key: "stale", label: "Ladenhüter (14+ Tage)" },
  { key: "sold", label: "Verkauft" },
  { key: "all", label: "Alle" },
];

export default async function Listings({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const { f = "active", q = "" } = await searchParams;
  const d = read();
  const staleBefore = new Date(Date.now() - 14 * 86400000).toISOString();
  const listings = d.listings
    .filter((l) => f === "all" ? l.status !== "deleted" : f === "sold" ? l.status === "sold" : l.status === "active")
    .filter((l) => f !== "stale" || (l.listed_at ?? "") < staleBefore)
    .filter((l) => !q || l.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(b.listed_at).localeCompare(String(a.listed_at)))
    .slice(0, 300)
    .map((l) => ({ ...l, accountLabel: d.accounts.find((a) => a.id === l.account_id)?.label }));

  return (
    <>
      <PageHeader title="Angebote" sub="Deine Artikel aus allen verbundenen Konten. Mindestpreis = Untergrenze für Automationen." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/angebote?f=${x.key}${q ? `&q=${q}` : ""}`} className={x.key === f ? "btn-primary" : "btn-ghost"}>{x.label}</Link>
        ))}
        <form className="ml-auto"><input type="hidden" name="f" value={f} /><input name="q" defaultValue={q} placeholder="Suchen…" className="input w-56" /></form>
      </div>

      {!listings.length ? (
        <Empty title="Keine Artikel">Sobald ein Konto synchronisiert ist, erscheinen deine Vinted-Artikel hier.</Empty>
      ) : (
        <div className="card divide-y divide-line">
          {listings.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-4 p-3">
              {l.photo_url ? <img src={l.photo_url} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="h-14 w-14 rounded-lg bg-panel-2" />}
              <div className="min-w-48 flex-1">
                <a href={l.url ?? "#"} target="_blank" className="font-medium hover:underline">{l.title}</a>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                  <StatusBadge status={l.status} />
                  <span>{l.accountLabel}</span>
                  <span>{[l.brand, l.size].filter(Boolean).join(" · ")}</span>
                  <span>👁 {l.views} · ♥ {l.favourites}</span>
                  <span>eingestellt {relDays(l.listed_at)}</span>
                </div>
              </div>
              <div className="w-20 text-right font-semibold">{eur(l.price)}</div>

              <form action={updateListingPrices} className="flex items-end gap-2">
                <input type="hidden" name="id" value={l.id} />
                <div><label className="label">Mindestpreis</label><input name="min_price" defaultValue={l.min_price ?? ""} className="input w-24" /></div>
                <div><label className="label">Einkauf</label><input name="purchase_price" defaultValue={l.purchase_price ?? ""} className="input w-20" /></div>
                <button className="btn-ghost">Speichern</button>
              </form>

              {l.status === "active" && (
                <div className="flex items-end gap-2">
                  <form action={queuePriceChange} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <div><label className="label">Neuer Preis</label><input name="price" className="input w-20" /></div>
                    <button className="btn-ghost">Ändern</button>
                  </form>
                  <form action={queueRelist.bind(null, l.id)}><button className="btn-ghost">Neu einstellen</button></form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
