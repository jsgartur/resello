"use server";
import { revalidatePath } from "next/cache";
import { write, read, id, now, log, queueJob, deleteImage, RuleType } from "@/lib/store";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(String(v).replace(",", ".")));

// ---------- Vinted-Konten ----------
export async function addAccount(form: FormData) {
  const label = String(form.get("label") || "Mein Shop");
  const connection = form.get("connection") === "cloud" ? "cloud" : "extension";
  const acc = write((d) => {
    const a = {
      id: id(), label, connection, domain: String(form.get("domain") || "vinted.de"), proxy: String(form.get("proxy") || "") || null,
      vinted_user_id: null, username: null, status: "pending", last_sync_at: null, last_error: null, created_at: now(),
    } as const;
    d.accounts.push({ ...a });
    return a;
  });
  log("account", `Konto "${label}" (${connection}) angelegt`, acc.id);
  revalidatePath("/konten");
}

export async function setAccountStatus(accountId: string, status: "paused" | "pending") {
  write((d) => { const a = d.accounts.find((x) => x.id === accountId); if (a) a.status = status; });
  revalidatePath("/konten");
}

export async function deleteAccount(accountId: string) {
  write((d) => {
    const convIds = new Set(d.conversations.filter((c) => c.account_id === accountId).map((c) => c.id));
    d.accounts = d.accounts.filter((a) => a.id !== accountId);
    d.listings = d.listings.filter((x) => x.account_id !== accountId);
    d.conversations = d.conversations.filter((x) => x.account_id !== accountId);
    d.messages = d.messages.filter((m) => !convIds.has(m.conversation_id));
    d.drafts = d.drafts.filter((x) => x.account_id !== accountId && !(x.conversation_id && convIds.has(x.conversation_id)));
    d.orders = d.orders.filter((x) => x.account_id !== accountId);
    d.favourites = d.favourites.filter((x) => x.account_id !== accountId);
    d.jobs = d.jobs.filter((x) => x.account_id !== accountId);
  });
  revalidatePath("/konten");
}

export async function queueSync(accountId: string) {
  write((d) => queueJob(d, accountId, "sync"));
  log("job", "Synchronisierung angestoßen", accountId);
  revalidatePath("/konten");
}

// ---------- Angebote ----------
export async function updateListingPrices(form: FormData) {
  write((d) => {
    const l = d.listings.find((x) => x.id === String(form.get("id")));
    if (l) { l.min_price = num(form.get("min_price")); l.purchase_price = num(form.get("purchase_price")); }
  });
  revalidatePath("/angebote");
}

export async function queueRelist(listingId: string) {
  const l = read().listings.find((x) => x.id === listingId);
  if (!l) return;
  write((d) => queueJob(d, l.account_id, "relist", { listing_id: l.id, vinted_item_id: l.vinted_item_id }));
  log("job", `Neu einstellen geplant: ${l.title}`, l.account_id);
  revalidatePath("/angebote");
}

export async function queuePriceChange(form: FormData) {
  const price = num(form.get("price"));
  const l = read().listings.find((x) => x.id === String(form.get("id")));
  if (!l || !price) return;
  if (l.min_price && price < l.min_price) throw new Error("Preis liegt unter dem Mindestpreis");
  write((d) => queueJob(d, l.account_id, "price_change", { listing_id: l.id, vinted_item_id: l.vinted_item_id, price }));
  log("job", `Preisänderung auf ${price} € geplant: ${l.title}`, l.account_id);
  revalidatePath("/angebote");
}

// ---------- Postfach ----------
export async function approveDraft(form: FormData) {
  const draftId = String(form.get("id"));
  const body = String(form.get("body") || "");
  write((d) => {
    const dr = d.drafts.find((x) => x.id === draftId);
    if (!dr) return;
    dr.status = "approved"; dr.body = body;
    const conv = dr.conversation_id ? d.conversations.find((c) => c.id === dr.conversation_id) : null;
    if (conv) queueJob(d, conv.account_id, "send_message", { draft_id: dr.id, vinted_conversation_id: conv.vinted_conversation_id, body });
    else if (dr.account_id && dr.target) queueJob(d, dr.account_id, "send_message", { draft_id: dr.id, ...dr.target, body });
  });
  revalidatePath("/postfach");
}

export async function rejectDraft(draftId: string) {
  write((d) => {
    const dr = d.drafts.find((x) => x.id === draftId);
    if (!dr) return;
    dr.status = "rejected";
    // Verhindert, dass beim nächsten Lauf sofort wieder ein Entwurf entsteht
    const conv = d.conversations.find((c) => c.id === dr.conversation_id);
    if (conv) conv.needs_action = null;
  });
  revalidatePath("/postfach");
}

export async function sendManualReply(form: FormData) {
  const body = String(form.get("body") || "").trim();
  if (!body) return;
  write((d) => {
    const conv = d.conversations.find((c) => c.id === String(form.get("conversation_id")));
    if (!conv) return;
    const dr = { id: id(), conversation_id: conv.id, account_id: conv.account_id, target: null, kind: "reply" as const, body, suggested_price: null, status: "approved" as const, created_at: now() };
    d.drafts.push(dr);
    queueJob(d, conv.account_id, "send_message", { draft_id: dr.id, vinted_conversation_id: conv.vinted_conversation_id, body });
  });
  revalidatePath("/postfach");
}

// ---------- Automationen ----------
export async function saveRule(form: FormData) {
  const type = String(form.get("type")) as RuleType;
  const enabled = form.get("enabled") === "on";
  const config: Record<string, string | number> = {};
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("cfg_")) continue;
    const s = String(v);
    const n = Number(s.replace(",", "."));
    config[k.slice(4)] = s !== "" && !Number.isNaN(n) && !s.includes(":") ? n : s;
  }
  write((d) => {
    const r = d.rules.find((x) => x.type === type);
    if (r) { r.enabled = enabled; r.config = config; } else d.rules.push({ id: id(), type, enabled, config });
  });
  log("automation", `Regel "${type}" ${enabled ? "aktiviert" : "deaktiviert"}`);
  revalidatePath("/automationen");
}

export async function runAutomationsNow() {
  const { runAutomations } = await import("@/lib/automation");
  await runAutomations();
  revalidatePath("/automationen");
  revalidatePath("/postfach");
}

// ---------- Finanzen ----------
export async function addExpense(form: FormData) {
  const amount = num(form.get("amount"));
  if (!amount) return;
  write((d) => d.expenses.push({ id: id(), label: String(form.get("label") || "Ausgabe"), amount, spent_at: String(form.get("spent_at") || now().slice(0, 10)) }));
  revalidatePath("/finanzen");
}

export async function deleteExpense(expenseId: string) {
  write((d) => { d.expenses = d.expenses.filter((e) => e.id !== expenseId); });
  revalidatePath("/finanzen");
}

// ---------- Studio ----------
export async function deleteStudioImage(imageId: string) {
  const img = read().studio_images.find((x) => x.id === imageId);
  if (img) [img.output_path, ...img.input_paths].forEach(deleteImage);
  write((d) => { d.studio_images = d.studio_images.filter((x) => x.id !== imageId); });
  revalidatePath("/galerie");
}

export async function deleteStudioModel(modelId: string) {
  const m = read().studio_models.find((x) => x.id === modelId);
  if (m) deleteImage(m.path);
  write((d) => { d.studio_models = d.studio_models.filter((x) => x.id !== modelId); });
  revalidatePath("/studio");
}

// ---------- Ein-Klick-Verbindung für die Chrome-Erweiterung ----------
export async function prepareExtensionConnection(domain: string) {
  const token = process.env.EXTENSION_TOKEN;
  if (!token) throw new Error("EXTENSION_TOKEN fehlt in der .env – bitte eintragen und Dashboard neu starten.");
  const existing = read().accounts.find((a) => a.connection === "extension" && a.domain === domain);
  const accountId = existing?.id ?? write((d) => {
    const a = { id: id(), label: `Vinted (${domain})`, connection: "extension" as const, domain, proxy: null, vinted_user_id: null, username: null, status: "pending" as const, last_sync_at: null, last_error: null, created_at: now() };
    d.accounts.push(a);
    return a.id;
  });
  revalidatePath("/konten");
  return { token, accountId, domain };
}

export async function toggleRule(type: RuleType) {
  write((d) => {
    const r = d.rules.find((x) => x.type === type);
    if (r) r.enabled = !r.enabled;
    else d.rules.push({ id: id(), type, enabled: true, config: {} });
  });
  revalidatePath("/automationen");
}

export async function queuePriceDrop(listingId: string, percent: number) {
  const l = read().listings.find((x) => x.id === listingId);
  if (!l) return;
  const target = Math.round(l.price * (1 - percent / 100) * 100) / 100;
  const price = l.min_price != null ? Math.max(l.min_price, target) : target;
  if (price >= l.price) return; // Mindestpreis erreicht
  write((d) => queueJob(d, l.account_id, "price_change", { listing_id: l.id, vinted_item_id: l.vinted_item_id, price }));
  log("job", `Preissenkung −${percent} % (${price} €) geplant: ${l.title}`, l.account_id);
  revalidatePath("/angebote");
}

export async function cancelJob(jobId: string) {
  write((d) => { const j = d.jobs.find((x) => x.id === jobId); if (j && j.status === "queued") j.status = "cancelled"; });
  revalidatePath("/angebote");
  revalidatePath("/automationen");
}

// ---------- Neues Angebot ----------
function readDraftForm(form: FormData) {
  return {
    id: String(form.get("id")),
    title: String(form.get("title") || "").trim(),
    description: String(form.get("description") || "").replace(/\r\n/g, "\n").trim(),
    price: num(form.get("price")),
    template_listing_id: String(form.get("template_listing_id") || "") || null,
    brand: String(form.get("brand") || "").trim() || null,
  };
}

export async function saveListingDraft(form: FormData) {
  const f = readDraftForm(form);
  write((d) => {
    const dr = d.listing_drafts.find((x) => x.id === f.id);
    if (dr) Object.assign(dr, { title: f.title, description: f.description, price: f.price, template_listing_id: f.template_listing_id, brand: f.brand, updated_at: now() });
  });
  revalidatePath("/neu");
}

export async function uploadListingDraft(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const f = readDraftForm(form);
  const d0 = read();
  const tpl = f.template_listing_id ? d0.listings.find((l) => l.id === f.template_listing_id) : null;
  if (!tpl) return { ok: false, error: "Bitte einen Vorlage-Artikel auswählen (für Kategorie, Größe und Paketgröße)." };
  if (!f.title || !f.price) return { ok: false, error: "Titel und Preis fehlen." };
  write((d) => {
    const dr = d.listing_drafts.find((x) => x.id === f.id);
    if (!dr) return;
    Object.assign(dr, { title: f.title, description: f.description, price: f.price, template_listing_id: tpl.id, brand: f.brand, account_id: tpl.account_id, status: "queued", error: null, updated_at: now() });
    queueJob(d, tpl.account_id, "create_listing", {
      draft_id: dr.id, template_item_id: tpl.vinted_item_id, template_brand: tpl.brand,
      title: f.title, description: f.description, price: f.price, brand: f.brand, photo_paths: dr.photos,
    });
  });
  log("job", `Neues Angebot zum Hochladen geplant: ${f.title}`, tpl.account_id);
  revalidatePath("/neu");
  return { ok: true };
}

export async function deleteListingDraft(draftId: string) {
  const dr = read().listing_drafts.find((x) => x.id === draftId);
  if (dr && dr.status !== "uploaded") dr.photos.forEach(deleteImage);
  write((d) => { d.listing_drafts = d.listing_drafts.filter((x) => x.id !== draftId); });
  revalidatePath("/neu");
}
