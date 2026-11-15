import "server-only";
import { read, write, id, now, log, queueJob, Draft } from "@/lib/store";
import { generateText } from "@/lib/gemini";

const DAY = 86400000;
const round = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

function berlinTime() {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
function inWindow(start?: string | number, end?: string | number) {
  if (!start || !end) return true;
  const t = berlinTime();
  return t >= String(start) && t <= String(end);
}

async function aiOrTemplate(prompt: string, fallback: string, tone: string) {
  try {
    const text = await generateText(prompt, `Du bist ein Vinted-Verkäufer und antwortest Käufern kurz (max. 2 Sätze) auf Deutsch. Ton: ${tone}. Keine Floskeln, keine Platzhalter. Gib nur den Nachrichtentext aus.`);
    return text || fallback;
  } catch {
    return fallback;
  }
}

/** Wertet alle aktiven Regeln aus und erzeugt Jobs bzw. Antwortentwürfe. */
export async function runAutomations() {
  const summary: Record<string, number> = {};
  const add = (k: string) => (summary[k] = (summary[k] ?? 0) + 1);
  const rules = read().rules.filter((r) => r.enabled);
  const tone = String(read().rules.find((r) => r.type === "ai_replies")?.config.tone ?? "freundlich, locker, per du");
  const openFor = (type: string) => new Set(read().jobs.filter((j) => j.type === type && (j.status === "queued" || j.status === "running")).map((j) => j.payload.listing_id));

  for (const rule of rules) {
    const c = rule.config;
    const before = { ...summary };

    // ---- Automatisches Neueinstellen ----
    if (rule.type === "relist" && inWindow(c.window_start, c.window_end)) {
      const afterDays = Number(c.after_days ?? 3);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const open = openFor("relist");
      write((d) => {
        let budget = Number(c.max_per_day ?? 20) - d.jobs.filter((j) => j.type === "relist" && j.created_at >= todayStart.toISOString()).length;
        const stale = d.listings
          .filter((l) => l.status === "active" && !open.has(l.id))
          .filter((l) => {
            const last = new Date(l.last_relisted_at ?? l.listed_at ?? now()).getTime();
            return Date.now() - last > afterDays * DAY;
          })
          .sort((a, b) => String(a.listed_at).localeCompare(String(b.listed_at)));
        for (const l of stale) {
          if (budget-- <= 0) break;
          queueJob(d, l.account_id, "relist", { listing_id: l.id, vinted_item_id: l.vinted_item_id });
          add("relist");
        }
      });
    }

    // ---- Preissenkung (nur Artikel MIT Mindestpreis, nie darunter) ----
    if (rule.type === "price_drop") {
      const percent = Number(c.percent ?? 10);
      const everyDays = Number(c.every_days ?? 7);
      const open = openFor("price_change");
      write((d) => {
        for (const l of d.listings) {
          if (l.status !== "active" || l.min_price == null || open.has(l.id)) continue;
          const last = new Date(l.last_price_drop_at ?? l.listed_at ?? 0).getTime();
          if (Date.now() - last < everyDays * DAY) continue;
          const target = Math.max(l.min_price, round(l.price * (1 - percent / 100)));
          if (target >= l.price - 0.009) continue;
          queueJob(d, l.account_id, "price_change", { listing_id: l.id, vinted_item_id: l.vinted_item_id, price: target });
          add("price_change");
        }
      });
    }

    // ---- Gegenangebote & KI-Antworten ----
    if (rule.type === "auto_counter" || rule.type === "ai_replies") {
      const wanted = rule.type === "auto_counter" ? "offer" : "reply";
      const data = read();
      const convs = data.conversations
        .filter((cv) => cv.needs_action === wanted)
        .filter((cv) => !data.drafts.some((dr) => dr.conversation_id === cv.id && dr.status === "pending"))
        .slice(0, 30);

      for (const cv of convs) {
        const listing = data.listings.find((l) => l.id === cv.listing_id) ?? null;
        const msgs = data.messages.filter((m) => m.conversation_id === cv.id).sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)));
        const lastIn = [...msgs].reverse().find((m) => m.direction === "in");
        if (!lastIn) continue;
        const history = msgs.slice(-6).map((m) => `${m.direction === "in" ? "Käufer" : "Ich"}: ${m.body}`).join("\n");
        let draft: Draft | null = null;

        if (rule.type === "auto_counter" && listing && lastIn.offer_price) {
          const floor = Math.max(listing.min_price ?? 0, round(listing.price * (1 - Number(c.max_discount_percent ?? 15) / 100)));
          const offer = lastIn.offer_price;
          const accept = offer >= floor;
          const price = accept ? offer : floor;
          const body = await aiOrTemplate(
            `Artikel: ${listing.title} (Preis ${listing.price} €). Käufer bietet ${offer} €. ${accept ? `Ich nehme ${price} € an.` : `Ich mache ein Gegenangebot von ${price} €.`}\nVerlauf:\n${history}\nSchreibe meine Antwort.`,
            accept ? `Passt, ${fmt(price)} ist okay für mich – du kannst das Angebot annehmen.` : `Für ${fmt(price)} würde ich ihn dir geben.`, tone);
          draft = { id: id(), conversation_id: cv.id, account_id: cv.account_id, target: null, kind: "counter_offer", body, suggested_price: price, status: "pending", created_at: now() };
          add("counter_draft");
        } else if (rule.type === "ai_replies") {
          const body = await aiOrTemplate(
            `Artikel: ${listing?.title ?? "unbekannt"}${listing ? ` (Preis ${listing.price} €)` : ""}.\nBeschreibung: ${listing?.description ?? "–"}\nVerlauf:\n${history}\nSchreibe meine Antwort auf die letzte Käufernachricht. Wenn du etwas nicht weißt (z.B. Maße), sag, dass du nachschaust.`,
            "Hi, danke für deine Nachricht! Ich schau kurz nach und melde mich gleich.", tone);
          draft = { id: id(), conversation_id: cv.id, account_id: cv.account_id, target: null, kind: "reply", body, suggested_price: null, status: "pending", created_at: now() };
          add("reply_draft");
        }
        if (draft) { const dr = draft; write((d) => d.drafts.push(dr)); }
      }
    }

    // ---- Favoriten anschreiben ----
    if (rule.type === "favourite_followup") {
      const discount = Number(c.discount_percent ?? 10);
      const template = String(c.template || "Hi! Ich hab gesehen, dass dir mein Artikel gefällt. Für dich gibt's {rabatt} % Rabatt: {preis} statt {alt}.");
      write((d) => {
        for (const f of d.favourites.filter((x) => !x.handled).slice(0, 50)) {
          f.handled = true;
          const l = d.listings.find((x) => x.account_id === f.account_id && x.vinted_item_id === f.vinted_item_id);
          if (!l || l.status !== "active") continue;
          const newPrice = Math.max(l.min_price ?? 0, round(l.price * (1 - discount / 100)));
          const body = template.replace("{rabatt}", String(discount)).replace("{preis}", fmt(newPrice)).replace("{alt}", fmt(l.price)).replace("{artikel}", l.title);
          d.drafts.push({
            id: id(), conversation_id: null, account_id: f.account_id, kind: "favourite_followup", body, suggested_price: newPrice, status: "pending", created_at: now(),
            target: { vinted_item_id: f.vinted_item_id, user_id: f.user_id, user_login: f.user_login, title: l.title },
          });
          add("favourite_draft");
        }
      });
    }
    const diff = Object.entries(summary).map(([k, v]) => [k, v - (before[k] ?? 0)] as const).filter(([, v]) => v > 0);
    write((d) => { const r = d.rules.find((x) => x.id === rule.id); if (r) { r.last_run_at = now(); r.last_result = diff.length ? diff.map(([k, v]) => `${v}× ${k}`).join(", ") : "nichts zu tun"; } });
  }

  const text = Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(", ");
  if (text) log("automation", `Automationen ausgeführt – ${text}`);
  return summary;
}

/** Läuft automatisch alle 15 Minuten, solange das Dashboard gestartet ist. */
export function startScheduler() {
  const g = globalThis as unknown as { __resello_scheduler?: NodeJS.Timeout };
  if (g.__resello_scheduler) return;
  g.__resello_scheduler = setInterval(() => { runAutomations().catch((e) => console.error("Automationen:", e)); }, 15 * 60000);
}
