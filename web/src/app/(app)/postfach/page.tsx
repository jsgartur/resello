/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { read, Conversation } from "@/lib/store";
import { dateTime, eur } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import { approveDraft, rejectDraft, sendManualReply } from "@/app/actions";
import { Inbox as InboxIcon, Tag, AlertTriangle, MessageCircle, ChevronRight, Search } from "lucide-react";

const FILTERS = [
  { key: "alle", label: "Alle" },
  { key: "ungelesen", label: "Ungelesen" },
  { key: "antwort", label: "Antwort nötig" },
  { key: "angebote", label: "Angebote" },
];

function Avatar({ c, size = 40 }: { c: Pick<Conversation, "avatar_url" | "other_user">; size?: number }) {
  return c.avatar_url ? (
    <img src={c.avatar_url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  ) : (
    <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-panel-2 text-sm font-semibold uppercase text-muted">
      {c.other_user.slice(0, 1)}
    </div>
  );
}

const shortDate = (d: string | null) => (d ? new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(new Date(d)) : "");

export default async function Inbox({ searchParams }: { searchParams: Promise<{ c?: string; f?: string; q?: string }> }) {
  const { c, f = "alle", q = "" } = await searchParams;
  const d = read();
  const pendingFor = (id: string) => d.drafts.filter((dr) => dr.conversation_id === id && dr.status === "pending").length;

  const all = [...d.conversations].sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at)));
  const convs = all
    .filter((x) => f === "ungelesen" ? x.unread : f === "antwort" ? x.needs_action === "reply" : f === "angebote" ? x.needs_action === "offer" : true)
    .filter((x) => !q || x.other_user.toLowerCase().includes(q.toLowerCase()) || (x.last_message ?? "").toLowerCase().includes(q.toLowerCase()))
    .slice(0, 200);

  const conv = c ? d.conversations.find((x) => x.id === c) ?? null : null;
  const msgs = conv ? d.messages.filter((m) => m.conversation_id === conv.id).sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at))) : [];
  const drafts = conv ? d.drafts.filter((dr) => dr.conversation_id === conv.id && dr.status === "pending") : [];
  const listing = conv?.listing_id ? d.listings.find((l) => l.id === conv.listing_id) ?? null : null;
  const favDrafts = d.drafts.filter((dr) => dr.kind === "favourite_followup" && dr.status === "pending");

  const counts = {
    reply: all.filter((x) => x.needs_action === "reply").length,
    offer: all.filter((x) => x.needs_action === "offer").length,
    unread: all.filter((x) => x.unread).length,
    drafts: d.drafts.filter((x) => x.status === "pending").length,
  };
  const next = all.find((x) => x.needs_action) ?? null;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(f !== "alle" ? { f } : {}), ...(q ? { q } : {}), ...extra });
    return `/postfach?${p.toString()}`;
  };
  const acc = d.accounts.find((a) => a.status === "connected");

  return (
    <>
      <PageHeader title="Postfach" sub={acc ? `@${acc.username ?? acc.label} · zuletzt aktualisiert ${dateTime(acc.last_sync_at)}` : "Kein Konto verbunden"} />

      {!all.length ? (
        <Empty title="Noch keine Nachrichten">Nach der ersten Synchronisierung erscheinen hier alle Käufernachrichten.</Empty>
      ) : (
        <div className="card grid h-[calc(100dvh-230px)] min-h-[460px] grid-cols-[minmax(0,1fr)] overflow-hidden lg:h-[calc(100vh-220px)] lg:min-h-[520px] lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Liste */}
          <div className={`${conv ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-line lg:border-r`}>
            <div className="space-y-3 border-b border-line p-3">
              <form className="relative">
                {f !== "alle" && <input type="hidden" name="f" value={f} />}
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input name="q" defaultValue={q} placeholder="Postfach durchsuchen" className="input pl-9" />
              </form>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((x) => (
                  <Link key={x.key} href={`/postfach?${new URLSearchParams({ ...(x.key !== "alle" ? { f: x.key } : {}), ...(q ? { q } : {}) })}`}
                    className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${f === x.key ? "border-accent/60 bg-accent/10 text-white" : "border-line text-muted hover:text-white"}`}>
                    {x.label}
                    {x.key === "alle" && <span className="ml-1 text-muted">{all.length}</span>}
                    {x.key === "ungelesen" && counts.unread > 0 && <span className="ml-1 text-accent">{counts.unread}</span>}
                    {x.key === "antwort" && counts.reply > 0 && <span className="ml-1 text-accent">{counts.reply}</span>}
                    {x.key === "angebote" && counts.offer > 0 && <span className="ml-1 text-accent">{counts.offer}</span>}
                  </Link>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {convs.map((x) => {
                const lst = x.listing_id ? d.listings.find((l) => l.id === x.listing_id) : null;
                const pend = pendingFor(x.id);
                return (
                  <Link key={x.id} href={qs({ c: x.id })}
                    className={`flex gap-3 border-b border-line/50 px-4 py-3 transition ${x.id === conv?.id ? "bg-accent/[0.07] shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-panel-2/60"}`}>
                    <Avatar c={x} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${x.unread ? "font-semibold text-white" : "font-medium"}`}>{x.other_user}</span>
                        <span className="shrink-0 text-[11px] text-muted">{shortDate(x.last_message_at)}</span>
                      </div>
                      <div className={`mt-0.5 truncate text-xs ${x.unread ? "text-white/90" : "text-muted"}`}>{x.last_message}</div>
                      {lst && <div className="truncate text-[11px] text-muted/70">{lst.title}</div>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lst && <span className="text-xs font-medium">{eur(lst.price)}</span>}
                        {x.needs_action === "offer" && <span className="badge border-accent/40 text-accent">Angebot</span>}
                        {x.needs_action === "reply" && <span className="badge border-amber-900 text-amber-400">Antwort nötig</span>}
                        {pend > 0 && <span className="badge border-accent/40 text-accent">KI-Entwurf</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {lst?.photo_url ? <img src={lst.photo_url} alt="" className="h-12 w-10 rounded-md object-cover" /> : <div className="h-12 w-10 rounded-md bg-panel-2" />}
                      {x.unread && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </div>
                  </Link>
                );
              })}
              {!convs.length && <div className="p-6 text-center text-sm text-muted">Keine Treffer.</div>}
            </div>
          </div>

          {/* Rechte Seite */}
          {!conv ? (
            <div className="hidden min-h-0 flex-col items-center justify-center overflow-y-auto p-8 lg:flex">
              <div className="w-full max-w-md">
                <h2 className="text-xl font-semibold">Mit dem Wichtigsten starten</h2>
                <p className="mt-1 text-sm text-muted">{all.length} Gespräche{next ? <> · höchste Priorität: <b className="text-white">{next.other_user}</b></> : ""}</p>
                <div className="mt-5 overflow-hidden rounded-xl border border-line">
                  <div className="flex items-center justify-between border-b border-line p-4">
                    <span className="font-medium">Antwort nötig</span>
                    <span className="text-2xl font-semibold">{counts.reply + counts.offer}</span>
                  </div>
                  <div className="grid grid-cols-2 text-sm">
                    <div className="flex items-center justify-between border-b border-r border-line p-4"><span className="flex items-center gap-2 text-muted"><Tag size={14} />Angebote</span><b>{counts.offer}</b></div>
                    <div className="flex items-center justify-between border-b border-line p-4"><span className="flex items-center gap-2 text-muted"><MessageCircle size={14} />Fragen</span><b>{counts.reply}</b></div>
                    <div className="flex items-center justify-between border-r border-line p-4"><span className="flex items-center gap-2 text-muted"><InboxIcon size={14} />Ungelesen</span><b>{counts.unread}</b></div>
                    <div className="flex items-center justify-between p-4"><span className="flex items-center gap-2 text-muted"><AlertTriangle size={14} />KI-Entwürfe</span><b>{counts.drafts}</b></div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Link href="/postfach?f=antwort" className="btn-ghost">Alle ansehen</Link>
                  {next && <Link href={qs({ c: next.id })} className="btn-primary">Nächste Aufgabe öffnen <ChevronRight size={16} /></Link>}
                </div>
              </div>

              {favDrafts.length > 0 && (
                <div className="mt-8 w-full max-w-2xl">
                  <div className="mb-3 text-sm font-medium">Favoriten-Nachrichten ({favDrafts.length})</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {favDrafts.map((dr) => (
                      <form key={dr.id} action={approveDraft} className="rounded-xl border border-line bg-panel-2/40 p-3">
                        <input type="hidden" name="id" value={dr.id} />
                        <div className="mb-2 text-xs text-muted">An <b className="text-white">{dr.target?.user_login}</b> · {dr.target?.title}{dr.suggested_price ? ` · ${eur(dr.suggested_price)}` : ""}</div>
                        <textarea name="body" defaultValue={dr.body} rows={2} className="input" />
                        <div className="mt-2 flex justify-end gap-2">
                          <button formAction={rejectDraft.bind(null, dr.id)} className="btn-ghost">Verwerfen</button>
                          <button className="btn-primary">Senden</button>
                        </div>
                      </form>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-col">
              <div className="flex items-center gap-3 border-b border-line p-3 lg:p-4">
                <Avatar c={conv} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{conv.other_user}</div>
                  {listing && <div className="truncate text-xs text-muted">{listing.title} · {eur(listing.price)}{listing.min_price ? ` · Mindestpreis ${eur(listing.min_price)}` : ""}</div>}
                </div>
                {listing?.photo_url && <img src={listing.photo_url} alt="" className="hidden h-11 w-11 rounded-lg object-cover sm:block" />}
                <Link href={qs({})} className="btn-ghost"><span className="lg:hidden">← Zurück</span><span className="hidden lg:inline">Schließen</span></Link>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {msgs.map((m) => (
                  <div key={m.id} className={`flex items-end gap-2 ${m.direction === "out" ? "justify-end" : ""}`}>
                    {m.direction === "in" && <Avatar c={conv} size={26} />}
                    <div className={`max-w-[85%] lg:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${m.direction === "out" ? "rounded-br-sm bg-accent/15" : "rounded-bl-sm bg-panel-2"}`}>
                      {m.offer_price != null && <div className="mb-1 text-xs font-semibold text-accent">Angebot: {eur(m.offer_price)}</div>}
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className="mt-1 text-[10px] text-muted">{dateTime(m.sent_at)}</div>
                    </div>
                  </div>
                ))}
                {!msgs.length && <div className="text-center text-sm text-muted">Nachrichten werden beim nächsten Sync geladen.</div>}
              </div>

              {drafts.map((dr) => (
                <form key={dr.id} action={approveDraft} className="border-t border-line bg-accent/5 p-4">
                  <input type="hidden" name="id" value={dr.id} />
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="badge border-accent/40 text-accent">KI-Entwurf · {dr.kind === "counter_offer" ? "Gegenangebot" : "Antwort"}</span>
                    {dr.suggested_price && <span className="text-muted">Vorschlag: {eur(dr.suggested_price)}</span>}
                  </div>
                  <textarea name="body" defaultValue={dr.body} rows={3} className="input" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button formAction={rejectDraft.bind(null, dr.id)} className="btn-ghost">Verwerfen</button>
                    <button className="btn-primary">Freigeben & senden</button>
                  </div>
                </form>
              ))}

              <form action={sendManualReply} className="flex gap-2 border-t border-line p-4">
                <input type="hidden" name="conversation_id" value={conv.id} />
                <input name="body" placeholder="Antwort schreiben…" className="input" />
                <button className="btn-primary">Senden</button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
