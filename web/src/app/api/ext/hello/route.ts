import { NextRequest, NextResponse } from "next/server";
import { checkExtensionToken } from "@/lib/apiauth";
import { write, log } from "@/lib/store";

/** Erweiterung/Worker meldet sich: verknüpft Vinted-User mit dem Konto. */
export async function POST(req: NextRequest) {
  if (!checkExtensionToken(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { account_id, vinted_user_id, username, domain } = await req.json();
  const acc = write((d) => {
    const a = d.accounts.find((x) => x.id === account_id);
    if (!a) return null;
    Object.assign(a, { status: "connected", vinted_user_id, username, last_error: null }, domain ? { domain } : {});
    return { id: a.id, label: a.label, status: a.status };
  });
  if (!acc) return NextResponse.json({ error: "Konto-ID nicht gefunden" }, { status: 404 });
  log("account", `@${username} verbunden`, account_id);
  return NextResponse.json({ ok: true, account: acc });
}
