import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Datei-Datenbank: alle Daten liegen in EINER Datei (data/resello.json).
 * Bilder aus dem Bildstudio liegen in data/bilder/.
 * Backup = Ordner "data" kopieren.
 */

export type Account = {
  id: string; label: string; domain: string; vinted_user_id: number | null; username: string | null;
  connection: "extension" | "cloud"; status: "pending" | "connected" | "error" | "paused";
  last_sync_at: string | null; last_error: string | null; proxy: string | null; created_at: string;
};
export type Listing = {
  id: string; account_id: string; vinted_item_id: number; title: string; description: string | null; brand: string | null;
  size: string | null; condition: string | null; price: number; currency: string; min_price: number | null; purchase_price: number | null;
  photo_url: string | null; url: string | null; status: "active" | "reserved" | "sold" | "hidden" | "deleted" | "draft";
  views: number; favourites: number; listed_at: string | null; last_relisted_at: string | null; last_price_drop_at: string | null;
  raw: unknown; updated_at: string;
};
export type Conversation = {
  id: string; account_id: string; vinted_conversation_id: number; other_user: string; listing_id: string | null;
  last_message: string | null; last_message_at: string | null; unread: boolean; needs_action: "reply" | "offer" | null; raw?: unknown;
};
export type Message = {
  id: string; conversation_id: string; vinted_message_id: number | null; direction: "in" | "out";
  body: string; offer_price: number | null; sent_at: string | null;
};
export type Draft = {
  id: string; conversation_id: string | null; account_id: string | null;
  target: { vinted_item_id: number; user_id: number; user_login: string | null; title?: string } | null;
  kind: "reply" | "counter_offer" | "favourite_followup"; body: string; suggested_price: number | null;
  status: "pending" | "approved" | "rejected" | "sent" | "failed"; created_at: string;
};
export type Order = {
  id: string; account_id: string; vinted_transaction_id: number; listing_id: string | null; title: string | null; buyer: string | null;
  country: string | null; price: number | null; shipping_fee: number | null; status: string | null; sold_at: string | null; raw?: unknown;
};
export type FavouriteEvent = { id: string; account_id: string; vinted_item_id: number; user_id: number; user_login: string | null; handled: boolean; created_at: string };
export type Expense = { id: string; label: string; amount: number; spent_at: string };
export type RuleType = "relist" | "price_drop" | "auto_counter" | "ai_replies" | "favourite_followup";
export type Rule = { id: string; type: RuleType; enabled: boolean; config: Record<string, string | number> };
export type JobType = "sync" | "relist" | "price_change" | "send_message" | "delete_item";
export type Job = {
  id: string; account_id: string; type: JobType; payload: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  status: "queued" | "running" | "done" | "failed" | "cancelled"; attempts: number; result: unknown; error: string | null;
  run_after: string; created_at: string; started_at: string | null; finished_at: string | null;
};
export type StudioImage = { id: string; tool: string; prompt: string; input_paths: string[]; output_path: string; created_at: string };
export type StudioModel = { id: string; name: string; gender: "m" | "w" | "x"; path: string; created_at: string };
export type Activity = { id: string; account_id: string | null; kind: string; message: string; created_at: string };

export type Data = {
  accounts: Account[]; listings: Listing[]; conversations: Conversation[]; messages: Message[]; drafts: Draft[];
  orders: Order[]; favourites: FavouriteEvent[]; expenses: Expense[]; rules: Rule[]; jobs: Job[];
  studio_images: StudioImage[]; studio_models: StudioModel[]; activity: Activity[];
};

const empty = (): Data => ({
  accounts: [], listings: [], conversations: [], messages: [], drafts: [], orders: [], favourites: [],
  expenses: [], rules: [], jobs: [], studio_images: [], studio_models: [], activity: [],
});

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const FILE = path.join(DATA_DIR, "resello.json");
export const IMAGE_DIR = path.join(DATA_DIR, "bilder");

// Cache im Prozess; wird neu geladen, wenn die Datei von außen geändert wurde
const g = globalThis as unknown as { __store?: { data: Data; mtime: number } };

function load(): Data {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    g.__store = { data: empty(), mtime: 0 };
    save(g.__store.data);
    return g.__store.data;
  }
  const mtime = fs.statSync(FILE).mtimeMs;
  if (g.__store && g.__store.mtime === mtime) return g.__store.data;
  const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<Data>;
  const data = { ...empty(), ...parsed };
  g.__store = { data, mtime };
  return data;
}

function save(data: Data) {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE); // atomar: Datei ist nie halb geschrieben
  g.__store = { data, mtime: fs.statSync(FILE).mtimeMs };
}

/** Nur lesen */
export function read(): Data {
  return load();
}

/** Lesen + ändern + speichern (synchron = keine gleichzeitigen Schreibkonflikte) */
export function write<T>(fn: (d: Data) => T): T {
  const data = load();
  const result = fn(data);
  // Aufräumen: Logs und alte Jobs begrenzen, damit die Datei klein bleibt
  if (data.activity.length > 500) data.activity = data.activity.slice(-500);
  if (data.jobs.length > 2000) data.jobs = data.jobs.filter((j) => j.status === "queued" || j.status === "running").concat(data.jobs.filter((j) => j.status !== "queued" && j.status !== "running").slice(-1000));
  save(data);
  return result;
}

export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export function log(kind: string, message: string, accountId?: string | null) {
  write((d) => { d.activity.push({ id: id(), kind, message, account_id: accountId ?? null, created_at: now() }); });
}

export function queueJob(d: Data, account_id: string, type: JobType, payload: Record<string, unknown> = {}) {
  const job: Job = { id: id(), account_id, type, payload, status: "queued", attempts: 0, result: null, error: null, run_after: now(), created_at: now(), started_at: null, finished_at: null };
  d.jobs.push(job);
  return job;
}

// ---------- Bilder ----------
export function saveImage(rel: string, data: Buffer) {
  const full = path.join(IMAGE_DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
  return rel;
}
export function readImage(rel: string) {
  const full = path.resolve(IMAGE_DIR, rel);
  if (!full.startsWith(IMAGE_DIR + path.sep)) throw new Error("Ungültiger Pfad");
  return fs.readFileSync(full);
}
export function deleteImage(rel: string) {
  try { fs.unlinkSync(path.join(IMAGE_DIR, rel)); } catch { /* schon weg */ }
}
export const imageUrl = (rel: string | null | undefined) => (rel ? `/api/bilder/${rel}` : null);
