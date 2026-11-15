import { NextRequest, NextResponse } from "next/server";
import { checkExtensionToken } from "@/lib/apiauth";
import { write, log, id, Conversation } from "@/lib/store";
import { normalizeConversation, normalizeFavourite, normalizeItem, normalizeOrder } from "@/lib/vinted-normalize";

export const maxDuration = 60;

/** Nimmt rohe Vinted-API-Daten entgegen (von Erweiterung oder Worker) und speichert sie. */
export async function POST(req: NextRequest) {
  if (!checkExtensionToken(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const accountId: string = body.account_id;

  const stats = write((d) => {
    const acc = d.accounts.find((a) => a.id === accountId);
    if (!acc) return null;
    const s = { items: 0, conversations: 0, messages: 0, orders: 0, favourites: 0 };
    const listingIdFor = (itemId: number | null) =>
      itemId ? d.listings.find((l) => l.account_id === accountId && l.vinted_item_id === itemId)?.id ?? null : null;

    // Artikel (Mindest-/Einkaufspreis bleiben erhalten)
    const seen = new Set<number>();
    for (const raw of body.items ?? []) {
      if (!raw?.id) continue;
      const n = normalizeItem(raw, accountId);
      seen.add(n.vinted_item_id);
      const existing = d.listings.find((l) => l.account_id === accountId && l.vinted_item_id === n.vinted_item_id);
      if (existing) Object.assign(existing, n, { listed_at: existing.last_relisted_at ?? n.listed_at ?? existing.listed_at });
      else d.listings.push({ ...n, id: id(), min_price: null, purchase_price: null, last_relisted_at: null, last_price_drop_at: null });
      s.items++;
    }
    // Nicht mehr vorhandene Artikel als gelöscht markieren (nur bei vollständigem Sync)
    if (body.items_complete && seen.size) {
      for (const l of d.listings) {
        if (l.account_id === accountId && ["active", "reserved", "hidden"].includes(l.status) && !seen.has(l.vinted_item_id)) l.status = "deleted";
      }
    }

    // Unterhaltungen inkl. Nachrichten
    for (const raw of body.conversations ?? []) {
      if (!raw?.id) continue;
      const n = normalizeConversation(raw, acc.vinted_user_id);
      const found = d.conversations.find((c) => c.account_id === accountId && c.vinted_conversation_id === n.conversation.vinted_conversation_id);
      const conv: Conversation = found ?? { ...n.conversation, id: id(), account_id: accountId, listing_id: listingIdFor(n.itemId) };
      if (found) Object.assign(found, n.conversation, { listing_id: listingIdFor(n.itemId) ?? found.listing_id });
      else d.conversations.push(conv);
      s.conversations++;
      for (const m of n.messages) {
        if (!m.vinted_message_id) continue;
        if (d.messages.some((x) => x.conversation_id === conv.id && x.vinted_message_id === m.vinted_message_id)) continue;
        d.messages.push({ ...m, id: id(), conversation_id: conv.id });
        s.messages++;
      }
    }

    // Bestellungen
    for (const raw of body.orders ?? []) {
      const { itemId, ...o } = normalizeOrder(raw, accountId);
      if (!o.vinted_transaction_id) continue;
      const existing = d.orders.find((x) => x.account_id === accountId && x.vinted_transaction_id === o.vinted_transaction_id);
      const row = { ...o, listing_id: listingIdFor(itemId) };
      if (existing) Object.assign(existing, row); else d.orders.push({ ...row, id: id() });
      s.orders++;
    }

    // Fallback: als verkauft markierte Artikel ohne Bestellung trotzdem als Verkauf zählen
    for (const l of d.listings) {
      if (l.account_id !== accountId || l.status !== "sold") continue;
      if (d.orders.some((o) => o.account_id === accountId && (o.listing_id === l.id || o.title === l.title))) continue;
      d.orders.push({
        id: id(), account_id: accountId, vinted_transaction_id: -l.vinted_item_id, listing_id: l.id, title: l.title,
        buyer: null, country: null, price: l.price, shipping_fee: null, status: "sold", sold_at: l.updated_at, raw: null,
      });
      s.orders++;
    }

    // Favoriten
    for (const raw of body.notifications ?? []) {
      const f = normalizeFavourite(raw);
      if (!f) continue;
      if (d.favourites.some((x) => x.account_id === accountId && x.vinted_item_id === f.vinted_item_id && x.user_id === f.user_id)) continue;
      d.favourites.push({ ...f, id: id(), account_id: accountId, handled: false, created_at: new Date().toISOString() });
      s.favourites++;
    }

    const errors: string[] = Array.isArray(body.errors) ? body.errors.map(String) : [];
    const gotData = Array.isArray(body.items) || Array.isArray(body.conversations);
    if (gotData) acc.last_sync_at = new Date().toISOString();
    acc.last_error = errors.length ? errors.join(" | ").slice(0, 500) : null;
    if (gotData) acc.status = "connected";
    return { ...s, errors };
  });

  if (!stats) return NextResponse.json({ error: "Konto-ID nicht gefunden" }, { status: 404 });
  log("sync", stats.errors.length && !stats.items && !stats.conversations
    ? `Sync-Fehler: ${stats.errors.join(" | ").slice(0, 300)}`
    : `Sync: ${stats.items} Artikel, ${stats.conversations} Chats, ${stats.orders} Verkäufe${stats.errors.length ? ` (Fehler: ${stats.errors.join(" | ").slice(0, 200)})` : ""}`, accountId);
  return NextResponse.json({ ok: true, stats });
}
