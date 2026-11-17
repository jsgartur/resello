import Link from "next/link";
import { read } from "@/lib/store";
import { eur, dateTime } from "@/lib/format";
import { PageHeader, Stat, Empty } from "@/components/ui";

const PERIODS = [
  { key: "7", label: "7 Tage", days: 7 },
  { key: "30", label: "30 Tage", days: 30 },
  { key: "90", label: "90 Tage", days: 90 },
  { key: "365", label: "12 Monate", days: 365 },
  { key: "alle", label: "Gesamt", days: 0 },
];

const shortDate = (d: string | null) => (d ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(d)) : "–");

export default async function Overview({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p = "30" } = await searchParams;
  const d = read();
  if (!d.accounts.length) {
    return (
      <>
        <PageHeader title="Übersicht" sub="Verbinde zuerst ein Vinted-Konto." />
        <Empty title="Noch kein Vinted-Konto verbunden">
          Lege unter <Link href="/konten" className="text-accent underline">Vinted-Konten</Link> ein Konto an. Das Bildstudio kannst du schon jetzt nutzen.
        </Empty>
      </>
    );
  }

  const period = PERIODS.find((x) => x.key === p) ?? PERIODS[1];
  const dated = d.orders.filter((o) => o.sold_at).sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)));
  const firstSale = dated[dated.length - 1]?.sold_at;
  const start = period.days ? new Date(Date.now() - period.days * 86400000) : new Date(firstSale ?? Date.now());
  const list = dated.filter((o) => new Date(o.sold_at!) >= start);
  const undated = d.orders.length - dated.length;
  const revenue = list.reduce((s, o) => s + (o.price ?? 0), 0);
  const active = d.listings.filter((l) => l.status === "active");
  const stock = active.reduce((s, l) => s + l.price, 0);
  const pendingDrafts = d.drafts.filter((x) => x.status === "pending").length;
  const actionConvs = d.conversations.filter((c) => c.needs_action).sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at))).slice(0, 6);
  const activity = [...d.activity].reverse().slice(0, 8);
  const lastSale = dated[0];
  const acc = d.accounts.find((a) => a.status === "connected") ?? d.accounts[0];
  const syncAgeH = acc?.last_sync_at ? (Date.now() - new Date(acc.last_sync_at).getTime()) / 3600000 : Infinity;

  // Balken: bis 30 Tage täglich, bis 90 Tage wöchentlich, sonst monatlich
  const span = Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000));
  const mode = span <= 31 ? "day" : span <= 120 ? "week" : "month";
  const buckets: { label: string; from: Date; to: Date }[] = [];
  if (mode === "day") {
    for (let i = span - 1; i >= 0; i--) { const f = new Date(); f.setHours(0, 0, 0, 0); f.setDate(f.getDate() - i); const t = new Date(f); t.setDate(t.getDate() + 1); buckets.push({ label: f.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), from: f, to: t }); }
  } else if (mode === "week") {
    for (let i = Math.ceil(span / 7) - 1; i >= 0; i--) { const t = new Date(Date.now() - i * 7 * 86400000); const f = new Date(t.getTime() - 7 * 86400000); buckets.push({ label: f.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), from: f, to: t }); }
  } else {
    const m = new Date(start.getFullYear(), start.getMonth(), 1);
    while (m <= new Date()) { const t = new Date(m.getFullYear(), m.getMonth() + 1, 1); buckets.push({ label: m.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), from: new Date(m), to: t }); m.setMonth(m.getMonth() + 1); }
  }
  const values = buckets.map((b) => list.filter((o) => { const t = new Date(o.sold_at!); return t >= b.from && t < b.to; }).reduce((s, o) => s + (o.price ?? 0), 0));
  const max = Math.max(1, ...values);

  return (
    <>
      <PageHeader title="Übersicht" sub={`Insgesamt ${d.orders.length} Verkäufe (${eur(d.orders.reduce((s, o) => s + (o.price ?? 0), 0))})${lastSale ? ` · letzter Verkauf ${shortDate(lastSale.sold_at)}` : ""}${undated ? ` · ${undated} ohne Datum` : ""}`} />

      {syncAgeH > 6 && (
        <div className="mb-4 rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          Letzte Synchronisierung: {dateTime(acc?.last_sync_at)}. Damit neue Verkäufe und Nachrichten ankommen, muss Chrome mit einem eingeloggten Vinted-Tab offen sein.
        </div>
      )}

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {PERIODS.map((x) => (
          <Link key={x.key} href={`/?p=${x.key}`} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${x.key === period.key ? "border-accent/60 bg-accent/10 text-white" : "border-line text-muted hover:text-white"}`}>{x.label}</Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label={`Umsatz · ${period.label}`} value={eur(revenue)} />
        <Stat label="Verkäufe" value={String(list.length)} />
        <Stat label="Ø Verkaufspreis" value={eur(list.length ? revenue / list.length : 0)} />
        <Stat label="Aktive Angebote" value={String(active.length)} hint={`Warenwert ${eur(stock)}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between text-sm">
            <span className="font-medium">Umsatzentwicklung</span>
            <span className="text-xs text-muted">{mode === "day" ? "pro Tag" : mode === "week" ? "pro Woche" : "pro Monat"}</span>
          </div>
          <div className="flex h-44 items-end gap-1">
            {values.map((v, i) => (
              <div key={i} title={`${buckets[i].label}: ${eur(v)}`} className="flex-1 rounded-t bg-accent/80 hover:bg-accent" style={{ height: `${Math.max(2, (v / max) * 100)}%`, opacity: v ? 1 : 0.2 }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted"><span>{buckets[0]?.label}</span><span>heute</span></div>
          {!list.length && <p className="mt-3 text-sm text-muted">Keine Verkäufe in diesem Zeitraum{lastSale ? ` – der letzte war am ${shortDate(lastSale.sold_at)}. Wähl oben einen längeren Zeitraum.` : "."}</p>}
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium">Letzte Verkäufe</span>
            <Link href="/finanzen?p=all" className="text-xs text-accent">Alle →</Link>
          </div>
          {dated.slice(0, 7).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm first:border-0">
              <div className="min-w-0"><div className="truncate">{o.title ?? "Artikel"}</div><div className="text-[11px] text-muted">{shortDate(o.sold_at)}</div></div>
              <span className="shrink-0 font-medium">{eur(o.price)}</span>
            </div>
          ))}
          {!dated.length && <p className="text-sm text-muted">Noch keine Verkäufe synchronisiert.</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Aktion erforderlich</div>
            <Link href="/postfach" className="text-xs text-accent">{pendingDrafts} Entwürfe warten →</Link>
          </div>
          {actionConvs.length ? actionConvs.map((c) => (
            <Link key={c.id} href={`/postfach?c=${c.id}`} className="block border-t border-line py-2 first:border-0">
              <div className="flex justify-between gap-2 text-sm"><span className="font-medium">{c.other_user}</span><span className="badge border-accent/40 text-accent">{c.needs_action === "offer" ? "Angebot" : "Antwort nötig"}</span></div>
              <div className="truncate text-sm text-muted">{c.last_message}</div>
            </Link>
          )) : <p className="text-sm text-muted">Alles erledigt.</p>}
        </div>
        <div className="card p-5">
          <div className="mb-3 text-sm font-medium">Letzte Aktivitäten</div>
          {activity.map((a) => (
            <div key={a.id} className="flex justify-between gap-4 border-t border-line py-2 text-sm first:border-0">
              <span className="line-clamp-2">{a.message}</span><span className="shrink-0 text-xs text-muted">{dateTime(a.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
