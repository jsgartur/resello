import Link from "next/link";
import { read } from "@/lib/store";
import { eur, dateTime } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui";
import { addExpense, deleteExpense } from "@/app/actions";

const PERIODS = { "30": "30 Tage", month: "Dieser Monat", year: "Dieses Jahr", all: "Gesamt" } as const;

function periodStart(p: string) {
  const now = new Date();
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "year") return new Date(now.getFullYear(), 0, 1);
  if (p === "all") return new Date(2000, 0, 1);
  return new Date(Date.now() - 30 * 86400000);
}

export default async function Finance({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p = "30" } = await searchParams;
  const start = periodStart(p).toISOString();
  const d = read();
  const orders = d.orders.filter((o) => (o.sold_at ?? "") >= start).sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)));
  const expenses = d.expenses.filter((e) => e.spent_at >= start.slice(0, 10)).sort((a, b) => b.spent_at.localeCompare(a.spent_at));
  const purchase = (listingId: string | null) => d.listings.find((l) => l.id === listingId)?.purchase_price ?? 0;

  const revenue = orders.reduce((s, o) => s + (o.price ?? 0), 0);
  const cogs = orders.reduce((s, o) => s + purchase(o.listing_id), 0);
  const other = expenses.reduce((s, e) => s + e.amount, 0);
  const profit = revenue - cogs - other;

  return (
    <>
      <PageHeader title="Finanzen" sub="Gewinn vor Steuern. Einkaufspreise trägst du bei den Angeboten ein.">
        <a href={`/api/export/orders?p=${p}`} className="btn-ghost">CSV-Export</a>
      </PageHeader>
      <div className="mb-4 flex gap-2">
        {Object.entries(PERIODS).map(([k, v]) => <Link key={k} href={`/finanzen?p=${k}`} className={k === p ? "btn-primary" : "btn-ghost"}>{v}</Link>)}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Umsatz" value={eur(revenue)} hint={`${orders.length} Verkäufe`} />
        <Stat label="Wareneinkauf" value={eur(-cogs)} />
        <Stat label="Sonstige Kosten" value={eur(-other)} />
        <Stat label="Gewinn" value={eur(profit)} hint={revenue ? `Marge ${Math.round((profit / revenue) * 100)} %` : undefined} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-x-auto">
          <div className="border-b border-line p-4 text-sm font-medium">Verkäufe</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="p-3">Datum</th><th>Artikel</th><th>Käufer</th><th>Land</th><th className="pr-3 text-right">Preis</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="p-3 text-muted">{dateTime(o.sold_at)}</td><td>{o.title}</td><td>{o.buyer}</td><td>{o.country}</td>
                  <td className="pr-3 text-right">{eur(o.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <div className="mb-3 text-sm font-medium">Sonstige Kosten</div>
          <form action={addExpense} className="mb-4 grid grid-cols-[1fr_90px] gap-2">
            <input name="label" placeholder="z.B. Versandtaschen" className="input" required />
            <input name="amount" placeholder="Betrag" className="input" required />
            <input name="spent_at" type="date" className="input" />
            <button className="btn-primary">Hinzufügen</button>
          </form>
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-t border-line py-2 text-sm">
              <span>{e.label} <span className="text-xs text-muted">{e.spent_at}</span></span>
              <span className="flex items-center gap-3">{eur(e.amount)}
                <form action={deleteExpense.bind(null, e.id)}><button className="text-xs text-muted hover:text-red-400">✕</button></form>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
