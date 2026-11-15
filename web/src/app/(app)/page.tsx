import Link from "next/link";
import { read } from "@/lib/store";
import { eur, dateTime } from "@/lib/format";
import { PageHeader, Stat, Empty } from "@/components/ui";

export default function Overview() {
  const d = read();
  if (!d.accounts.length) {
    return (
      <>
        <PageHeader title="Übersicht" sub="Verbinde zuerst ein Vinted-Konto." />
        <Empty title="Noch kein Vinted-Konto verbunden">
          Lege unter <Link href="/konten" className="text-accent underline">Vinted-Konten</Link> ein Konto an – per Chrome-Erweiterung oder Cloud-Login.
          Das Bildstudio kannst du schon jetzt nutzen.
        </Empty>
      </>
    );
  }

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const list = d.orders.filter((o) => (o.sold_at ?? "") >= since);
  const undated = d.orders.filter((o) => !o.sold_at).length;
  const revenue = list.reduce((s, o) => s + (o.price ?? 0), 0);
  const active = d.listings.filter((l) => l.status === "active").length;
  const pendingDrafts = d.drafts.filter((x) => x.status === "pending").length;
  const actionConvs = d.conversations.filter((c) => c.needs_action).sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at))).slice(0, 6);
  const activity = [...d.activity].reverse().slice(0, 8);

  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
  const perDay = days.map((day) => list.filter((o) => o.sold_at?.slice(0, 10) === day).reduce((s, o) => s + (o.price ?? 0), 0));
  const max = Math.max(1, ...perDay);
  const countries = Object.entries(list.reduce<Record<string, number>>((acc, o) => { const c = o.country || "?"; acc[c] = (acc[c] ?? 0) + (o.price ?? 0); return acc; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <PageHeader title="Übersicht" sub={`Dein Geschäft der letzten 30 Tage · insgesamt ${d.orders.length} Verkäufe (${eur(d.orders.reduce((s, o) => s + (o.price ?? 0), 0))})${undated ? ` · ${undated} ohne Datum – bitte einmal synchronisieren` : ""}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Umsatz" value={eur(revenue)} />
        <Stat label="Bestellungen" value={String(list.length)} />
        <Stat label="Ø Bestellwert" value={eur(list.length ? revenue / list.length : 0)} />
        <Stat label="Aktive Angebote" value={String(active)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 text-sm font-medium">Verkaufsentwicklung</div>
          <div className="flex h-40 items-end gap-1">
            {perDay.map((v, i) => (
              <div key={i} title={`${days[i]}: ${eur(v)}`} className="flex-1 rounded-t bg-accent/80 hover:bg-accent" style={{ height: `${Math.max(2, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted"><span>{days[0]}</span><span>heute</span></div>
        </div>
        <div className="card p-5">
          <div className="mb-3 text-sm font-medium">Wo deine Käufer sind</div>
          {countries.length ? countries.map(([c, v]) => (
            <div key={c} className="mb-2">
              <div className="flex justify-between text-sm"><span>{c}</span><span>{eur(v)}</span></div>
              <div className="mt-1 h-1.5 rounded bg-panel-2"><div className="h-1.5 rounded bg-accent" style={{ width: `${(v / revenue) * 100}%` }} /></div>
            </div>
          )) : <p className="text-sm text-muted">{list.length ? "Vinted liefert zu deinen Verkäufen kein Käuferland." : "Keine Verkäufe in den letzten 30 Tagen."}</p>}
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
              <div className="flex justify-between text-sm"><span className="font-medium">{c.other_user}</span><span className="badge border-accent/40 text-accent">{c.needs_action === "offer" ? "Angebot" : "Antwort nötig"}</span></div>
              <div className="truncate text-sm text-muted">{c.last_message}</div>
            </Link>
          )) : <p className="text-sm text-muted">Alles erledigt.</p>}
        </div>
        <div className="card p-5">
          <div className="mb-3 text-sm font-medium">Letzte Aktivitäten</div>
          {activity.map((a) => (
            <div key={a.id} className="flex justify-between gap-4 border-t border-line py-2 text-sm first:border-0">
              <span className="truncate">{a.message}</span><span className="shrink-0 text-xs text-muted">{dateTime(a.created_at)}</span>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap gap-2">
            {d.accounts.map((a) => <span key={a.id} className="badge">{a.label}: {a.status} · Sync {dateTime(a.last_sync_at)}</span>)}
          </div>
        </div>
      </div>
    </>
  );
}
