import { NextRequest, NextResponse } from "next/server";
import { checkExtensionToken } from "@/lib/apiauth";
import { write, now } from "@/lib/store";

/** Holt den nächsten fälligen Job. */
export async function POST(req: NextRequest) {
  if (!checkExtensionToken(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { executor = "extension", account_id = null } = await req.json().catch(() => ({}));

  const job = write((d) => {
    // Hängengebliebene Jobs (z.B. Browser geschlossen) nach 10 Min. wieder freigeben
    const stuck = new Date(Date.now() - 10 * 60000).toISOString();
    for (const j of d.jobs) if (j.status === "running" && (j.started_at ?? "") < stuck) j.status = "queued";

    const t = now();
    const next = d.jobs
      .filter((j) => j.status === "queued" && j.run_after <= t && (!account_id || j.account_id === account_id))
      .filter((j) => { const a = d.accounts.find((x) => x.id === j.account_id); return a && a.connection === executor && a.status !== "paused"; })
      .sort((a, b) => a.run_after.localeCompare(b.run_after))[0];
    if (!next) return null;
    Object.assign(next, { status: "running", attempts: next.attempts + 1, started_at: t });
    const l = next.payload.listing_id ? d.listings.find((x) => x.id === next.payload.listing_id) : null;
    return { ...next, payload: { ...next.payload, listing: l ? { title: l.title, price: l.price } : undefined } };
  });
  return NextResponse.json({ job });
}
