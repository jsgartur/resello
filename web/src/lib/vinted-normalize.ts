/**
 * Wandelt rohe Antworten der (inoffiziellen) Vinted-Web-API in unser Datenmodell um.
 * Vinted ändert Feldnamen gelegentlich – deshalb wird hier defensiv mit mehreren Kandidaten gearbeitet.
 * Wenn nach einem Vinted-Update Felder leer bleiben: im Browser DevTools → Network die Antwort ansehen und hier anpassen.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Raw = Record<string, any>;

function pick(obj: Raw | undefined | null, ...paths: string[]): any {
  for (const p of paths) {
    const v = p.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export function money(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "object") return money(v.amount ?? v.value);
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ts(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizeItem(raw: Raw, accountId: string) {
  const status: "active" | "reserved" | "sold" | "hidden" | "deleted" | "draft" =
    pick(raw, "is_draft") ? "draft" :
    pick(raw, "is_closed") || pick(raw, "item_closing_action") === "sold" ? "sold" :
    pick(raw, "is_reserved") ? "reserved" :
    pick(raw, "is_hidden") ? "hidden" : "active";
  return {
    account_id: accountId,
    vinted_item_id: Number(raw.id),
    title: String(pick(raw, "title") ?? "Ohne Titel"),
    description: pick(raw, "description") ?? null,
    brand: pick(raw, "brand_title", "brand.title", "brand") ?? null,
    size: pick(raw, "size_title", "size.title", "size") ?? null,
    condition: pick(raw, "status", "status_title") ?? null,
    price: money(pick(raw, "price", "price_numeric", "total_item_price")) ?? 0,
    currency: pick(raw, "currency", "price.currency_code") ?? "EUR",
    photo_url: pick(raw, "photo.url", "photos.0.url", "photo.thumbnails.0.url") ?? null,
    url: pick(raw, "url", "path") ?? null,
    status,
    views: Number(pick(raw, "view_count") ?? 0),
    favourites: Number(pick(raw, "favourite_count") ?? 0),
    listed_at: ts(pick(raw, "created_at_ts", "photo.high_resolution.timestamp", "created_at", "last_push_up_at")),
    raw,
    updated_at: new Date().toISOString(),
  };
}

export type NormalizedMessage = { vinted_message_id: number | null; direction: "in" | "out"; body: string; offer_price: number | null; sent_at: string | null };

export function normalizeConversation(raw: Raw, myUserId: number | null) {
  const other = pick(raw, "opposite_user.login", "opposite_user.username") ?? "Unbekannt";
  const itemId = pick(raw, "transaction.item_id", "item_id", "transaction.item.id");
  const msgs: NormalizedMessage[] = (raw.messages ?? []).map((m: Raw) => {
    const e = m.entity ?? m;
    const userId = pick(e, "user_id", "sender_id");
    const offer = m.entity_type?.includes("offer") ? money(pick(e, "price", "offer_price", "price_label")) : null;
    return {
      vinted_message_id: pick(m, "id", "entity.id") ?? null,
      direction: myUserId && Number(userId) === Number(myUserId) ? "out" : userId ? "in" : "out",
      body: String(pick(e, "body", "title", "subtitle") ?? (offer ? `Angebot ${offer} €` : "")),
      offer_price: offer,
      sent_at: ts(pick(m, "created_at_ts", "created_time_ago", "entity.created_at_ts", "created_at")),
    } as NormalizedMessage;
  }).filter((m: NormalizedMessage) => m.body || m.offer_price);

  const last = msgs[msgs.length - 1];
  const needs_action: "offer" | "reply" | null = last && last.direction === "in" ? (last.offer_price ? "offer" : "reply") : null;
  return {
    conversation: {
      vinted_conversation_id: Number(raw.id),
      other_user: String(other),
      last_message: last?.body ?? pick(raw, "description") ?? null,
      last_message_at: last?.sent_at ?? ts(pick(raw, "updated_at")),
      unread: !!pick(raw, "unread", "is_unread"),
      needs_action,
      avatar_url: (pick(raw, "opposite_user.photo.thumbnails.1.url", "opposite_user.photo.url", "opposite_user.photo.thumbnails.0.url") as string | undefined) ?? null,
      raw: { ...raw, messages: undefined },
    },
    itemId: itemId ? Number(itemId) : null,
    messages: msgs,
  };
}

export function normalizeOrder(raw: Raw, accountId: string) {
  return {
    account_id: accountId,
    vinted_transaction_id: Number(pick(raw, "transaction_id", "id")),
    title: pick(raw, "title", "item_title") ?? null,
    buyer: pick(raw, "user.login", "buyer.login", "opposite_user.login") ?? null,
    country: pick(raw, "buyer.country_title", "user.country_title", "country") ?? null,
    price: money(pick(raw, "price", "total_amount", "item_price")),
    shipping_fee: money(pick(raw, "shipping_price", "shipment_price")),
    status: pick(raw, "status", "transaction_user_status") ?? null,
    sold_at: ts(pick(raw, "date", "created_at", "updated_at")),
    itemId: pick(raw, "item_id", "item.id") ? Number(pick(raw, "item_id", "item.id")) : null,
    raw,
  };
}

/** Favoriten-Benachrichtigungen ("X hat deinen Artikel favorisiert") */
export function normalizeFavourite(raw: Raw) {
  const isFav = String(pick(raw, "entry_type", "type", "notification_type") ?? "").toLowerCase().includes("fav")
    || /favorisiert|favourite|favorite/i.test(String(pick(raw, "body") ?? ""));
  const itemId = pick(raw, "subject_id", "item_id", "item.id");
  const userId = pick(raw, "user_id", "user.id", "photo.user_id");
  if (!isFav || !itemId || !userId) return null;
  return { vinted_item_id: Number(itemId), user_id: Number(userId), user_login: pick(raw, "user.login", "user_login") ?? null };
}
