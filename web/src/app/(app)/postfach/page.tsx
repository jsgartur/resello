import Link from "next/link";
import { read } from "@/lib/store";
import { dateTime, eur } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import { approveDraft, rejectDraft, sendManualReply } from "@/app/actions";

export default async function Inbox({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const d = read();
  const convs = [...d.conversations]
    .sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at))).slice(0, 100)
    .map((x) => ({ ...x, pending: d.drafts.filter((dr) => dr.conversation_id === x.id && dr.status === "pending").length }));
  const selectedId = c ?? convs[0]?.id;
  const conv = d.conversations.find((x) => x.id === selectedId) ?? null;
  const msgs = d.messages.filter((m) => m.conversation_id === selectedId).sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)));
  const drafts = d.drafts.filter((dr) => dr.conversation_id === selectedId && dr.status === "pending");
  const favDrafts = d.drafts.filter((dr) => dr.kind === "favourite_followup" && dr.status === "pending");
  const listing = conv?.listing_id ? d.listings.find((l) => l.id === conv.listing_id) ?? null : null;

  const favSection = favDrafts.length ? (
    <div className="card mb-4 p-4">
      <div className="mb-3 text-sm font-medium">Favoriten-Nachrichten ({favDrafts.length})</div>
      <div className="grid gap-3 md:grid-cols-2">
        {favDrafts.map((dr) => {
          const t = dr.target ?? { user_login: null, title: "" };
          return (
            <form key={dr.id} action={approveDraft} className="rounded-lg border border-line p-3">
              <input type="hidden" name="id" value={dr.id} />
              <div className="mb-2 text-xs text-muted">An <b className="text-white">{t.user_login}</b> · {t.title}{dr.suggested_price ? ` · ${eur(dr.suggested_price)}` : ""}</div>
              <textarea name="body" defaultValue={dr.body} rows={2} className="input" />
              <div className="mt-2 flex justify-end gap-2">
                <button formAction={rejectDraft.bind(null, dr.id)} className="btn-ghost">Verwerfen</button>
                <button className="btn-primary">Senden</button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  ) : null;

  if (!convs.length) {
    return (<><PageHeader title="Postfach" />{favSection}<Empty title="Noch keine Nachrichten">Nach der ersten Synchronisierung erscheinen hier alle Käufernachrichten.</Empty></>);
  }

  return (
    <>
      <PageHeader title="Postfach" sub="KI-Entwürfe werden erst gesendet, wenn du sie freigibst." />
      {favSection}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card max-h-[75vh] divide-y divide-line overflow-y-auto">
          {convs.map((x) => {
            const pending = x.pending;
            return (
              <Link key={x.id} href={`/postfach?c=${x.id}`} className={`block p-3 ${x.id === selectedId ? "bg-panel-2" : "hover:bg-panel-2"}`}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className={`truncate ${x.unread ? "font-semibold" : ""}`}>{x.other_user}</span>
                  <span className="shrink-0 text-[11px] text-muted">{dateTime(x.last_message_at)}</span>
                </div>
                <div className="truncate text-xs text-muted">{x.last_message}</div>
                <div className="mt-1 flex gap-1">
                  {x.needs_action && <span className="badge text-amber-400">{x.needs_action}</span>}
                  {pending > 0 && <span className="badge text-accent">{pending} Entwurf</span>}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="card flex max-h-[75vh] flex-col">
          <div className="border-b border-line p-4">
            <div className="font-medium">{conv?.other_user}</div>
            {listing && <div className="text-xs text-muted">{listing.title} · {eur(listing.price)}{listing.min_price ? ` · Mindestpreis ${eur(listing.min_price)}` : ""}</div>}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {msgs.map((m) => (
              <div key={m.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.direction === "out" ? "ml-auto bg-accent/15" : "bg-panel-2"}`}>
                {m.offer_price && <div className="mb-1 text-xs font-semibold text-accent">Angebot: {eur(m.offer_price)}</div>}
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-1 text-[10px] text-muted">{dateTime(m.sent_at)}</div>
              </div>
            ))}
          </div>

          {drafts.map((d) => (
            <form key={d.id} action={approveDraft} className="border-t border-line bg-panel-2/50 p-4">
              <input type="hidden" name="id" value={d.id} />
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="badge text-accent">KI-Entwurf · {d.kind}</span>
                {d.suggested_price && <span className="text-muted">Vorschlag: {eur(d.suggested_price)}</span>}
              </div>
              <textarea name="body" defaultValue={d.body} rows={3} className="input" />
              <div className="mt-2 flex justify-end gap-2">
                <button formAction={rejectDraft.bind(null, d.id)} className="btn-ghost">Verwerfen</button>
                <button className="btn-primary">Freigeben & senden</button>
              </div>
            </form>
          ))}

          {selectedId && (
            <form action={sendManualReply} className="flex gap-2 border-t border-line p-4">
              <input type="hidden" name="conversation_id" value={selectedId} />
              <input name="body" placeholder="Eigene Antwort schreiben…" className="input" />
              <button className="btn-ghost">Senden</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
