import { NextRequest, NextResponse } from "next/server";
import { checkExtensionToken } from "@/lib/apiauth";
import { write, log, now } from "@/lib/store";

const MAX_ATTEMPTS = 3;

/** Ergebnis eines Jobs melden – inkl. Folgeaktualisierungen. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkExtensionToken(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: jobId } = await params;
  const { status, error, result } = await req.json();

  const out = write((d) => {
    const job = d.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    const p = job.payload;
    const t = now();

    if (status === "failed") {
      const retry = job.attempts < MAX_ATTEMPTS;
      Object.assign(job, { status: retry ? "queued" : "failed", error, run_after: new Date(Date.now() + 5 * 60000 * job.attempts).toISOString(), finished_at: retry ? null : t });
      if (!retry && p.draft_id) { const dr = d.drafts.find((x) => x.id === p.draft_id); if (dr) dr.status = "failed"; }
      return { job, retry, msg: retry ? null : `Job ${job.type} fehlgeschlagen: ${error}` };
    }

    Object.assign(job, { status: "done", result, error: null, finished_at: t });
    let msg: string | null = null;
    if (job.type === "send_message" && p.draft_id) {
      const dr = d.drafts.find((x) => x.id === p.draft_id); if (dr) dr.status = "sent";
      const conv = d.conversations.find((c) => c.account_id === job.account_id && c.vinted_conversation_id === p.vinted_conversation_id);
      if (conv) Object.assign(conv, { needs_action: null, last_message: p.body, last_message_at: t });
    }
    const l = p.listing_id ? d.listings.find((x) => x.id === p.listing_id) : null;
    if (job.type === "price_change" && l) { Object.assign(l, { price: p.price, last_price_drop_at: t }); msg = `Preis geändert auf ${p.price} €: ${l.title}`; }
    if (job.type === "relist" && l) {
      Object.assign(l, result?.new_item_id ? { vinted_item_id: result.new_item_id, url: result.new_url ?? l.url } : {}, { listed_at: t, last_relisted_at: t, views: 0, favourites: 0 });
      msg = `Neu eingestellt: ${l.title}`;
    }
    if (job.type === "delete_item" && l) l.status = "deleted";
    return { job, retry: false, msg };
  });

  if (!out) return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
  if (out.msg) log("job", out.msg, out.job.account_id);
  return NextResponse.json({ ok: true, retry: out.retry });
}
